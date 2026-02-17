#!/usr/bin/env python3
"""
Weekly Update - Run after each tournament
-----------------------------------------
One script to update everything: tournament results, SG breakdown, and skill profiles.

Usage:
    python weekly_update.py --tournament-id <UUID>   # Use field from odds (tournament_players) - preferred
    python weekly_update.py                          # Auto-detect most recent PGA tournament (Data Golf)
    python weekly_update.py --event 4 --year 2026    # Specific Data Golf event
    python weekly_update.py --latest                 # Same as no args

Flow:
    1. Gets player list: from --tournament-id (tournament_players), --field-file, or Data Golf past-results
    2. For each player: scrapes profile, upserts tournament records (with full SG),
       refreshes skill profile in pga_players
"""

import time
import os
import re
import argparse
import pandas as pd
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_latest_pga_tournament(driver) -> tuple[int, int] | None:
    """Scrape past-results page to find most recent completed PGA tournament (by date)."""
    driver.get("https://datagolf.com/past-results/pga-tour")
    time.sleep(5)
    
    html = driver.page_source
    matches = re.findall(r"/past-results/pga-tour/(\d+)/(\d{4})", html)
    seen = set()
    candidates = []
    for e, y in matches:
        if int(y) >= 2024 and (e, y) not in seen:
            seen.add((e, y))
            candidates.append((int(e), int(y)))
    
    # Fetch date for each candidate, keep only those with results; sort by date desc
    today = datetime.now().strftime("%Y-%m-%d")
    with_dates = []
    for event_id, year in candidates[:15]:  # Check recent candidates
        url = f"https://datagolf.com/past-results/pga-tour/{event_id}/{year}"
        driver.get(url)
        time.sleep(3)
        result = driver.execute_script("""
            let rd = window.reload_data;
            if (!rd || !rd.lb || rd.lb.length === 0) return null;
            let info = rd.info;
            if (Array.isArray(info)) info = info[0];
            return info ? info.date : null;
        """)
        if result:
            with_dates.append((event_id, year, result))
    
    if not with_dates:
        return None
    
    # Sort by tournament date descending (most recent first)
    with_dates.sort(key=lambda x: x[2], reverse=True)
    return (with_dates[0][0], with_dates[0][1])


def fetch_field_from_past_results(driver, event_id: int, year: int) -> tuple[list[str], dict] | None:
    """Fetch full field and tournament info from past-results page."""
    url = f"https://datagolf.com/past-results/pga-tour/{event_id}/{year}"
    driver.get(url)
    time.sleep(5)
    
    data = driver.execute_script("""
        let rd = window.reload_data;
        if (!rd || !rd.lb) return null;
        return {
            players: rd.lb.map(p => ({ player_name: p.player_name })),
            info: rd.info,
            course: rd.course
        };
    """)
    
    if not data or not data.get("players"):
        return None
    
    players = []
    for row in data["players"]:
        name = row.get("player_name", "")
        if "," in name:
            last, first = name.split(",", 1)
            players.append(f"{first.strip()} {last.strip()}")
        else:
            players.append(name.strip())
    
    info = data.get("info") or {}
    if isinstance(info, list):
        info = info[0] if info else {}
    
    tournament = {
        "name": info.get("event_name") or info.get("display_name") or f"Event {event_id}",
        "date": info.get("date", f"{year}-01-01"),
    }
    
    return (players, tournament)


def get_player_id(name: str) -> str | None:
    r = supabase.table("pga_players").select("id").eq("name", name).execute()
    if r.data:
        return r.data[0]["id"]
    last = name.split()[-1]
    r = supabase.table("pga_players").select("id, name").ilike("name", f"%{last}%").execute()
    for p in r.data or []:
        if last.lower() == p["name"].split()[-1].lower():
            return p["id"]
    return None


def scrape_player(driver, name: str) -> dict | None:
    driver.get("https://datagolf.com/player-profiles")
    time.sleep(3)
    
    inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='text']")
    search = next((inp for inp in inputs if inp.is_displayed()), None)
    if not search:
        return None
    
    search.send_keys(name)
    time.sleep(2)
    
    last = name.split()[-1].lower()
    items = driver.find_elements(By.CSS_SELECTOR, ".ui-menu-item")
    for item in items:
        try:
            if item.is_displayed() and last in item.text.lower():
                item.click()
                break
        except Exception:
            pass
    
    time.sleep(4)
    
    if last not in driver.title.lower():
        return None
    
    return driver.execute_script("""
        return {
            new_data: window.new_data || [],
            reload_data: window.reload_data || null
        };
    """)


def process_tournament_records(new_data: list, pga_id: str) -> list[dict]:
    if not new_data:
        return []
    df = pd.DataFrame(new_data)
    for col in ["total", "ott", "app", "arg", "putt"]:
        if col in df.columns:
            df[col] = df[col].apply(
                lambda x: None if x is None or (isinstance(x, (int, float)) and x <= -9000) else x
            )
    
    agg = df.groupby(["event_name", "date"]).agg({
        "course_name": "first",
        "fin_numeric": "first",
        "fin_text": "first",
        "total": "mean",
        "ott": "mean",
        "app": "mean",
        "arg": "mean",
        "putt": "mean",
        "round_score": "sum",
    }).reset_index()
    
    records = []
    for _, row in agg.iterrows():
        try:
            dt = datetime.strptime(row["date"], "%b %d, %Y")
            tournament_date = dt.strftime("%Y-%m-%d")
        except Exception:
            continue
        
        records.append({
            "pga_player_id": pga_id,
            "tournament_name": row["event_name"],
            "course_name": row["course_name"] or "",
            "tournament_date": tournament_date,
            "finish_position": int(row["fin_numeric"]) if pd.notna(row["fin_numeric"]) and row["fin_numeric"] < 900 else None,
            "is_made_cut": row["fin_text"] not in ["CUT", "WD", "DQ", "MDF"],
            "total_score": int(row["round_score"]) if pd.notna(row["round_score"]) else None,
            "strokes_gained_total": round(float(row["total"]), 3) if pd.notna(row["total"]) else None,
            "strokes_gained_putting": round(float(row["putt"]), 3) if pd.notna(row["putt"]) else None,
            "strokes_gained_approach": round(float(row["app"]), 3) if pd.notna(row["app"]) else None,
            "strokes_gained_around_green": round(float(row["arg"]), 3) if pd.notna(row["arg"]) else None,
            "strokes_gained_off_tee": round(float(row["ott"]), 3) if pd.notna(row["ott"]) else None,
        })
    return records


def process_skills(reload_data: dict | None) -> dict | None:
    if not reload_data or not reload_data.get("break_skills"):
        return None
    skills = reload_data["break_skills"]
    m = {s["bin"]: s["perc"] for s in skills}
    v = {s["bin"]: s["val"] for s in skills}
    
    def sg(x):
        try:
            return round(float(str(x).replace("+", "")), 3)
        except Exception:
            return None
    
    return {
        "dg_id": reload_data.get("dg_id"),
        "driving_overall": m.get("driving"),
        "driving_distance": m.get("ott_1"),
        "driving_accuracy": m.get("ott_2"),
        "approach_overall": m.get("approach"),
        "approach_50_100": m.get("app_1"),
        "approach_100_150": m.get("app_2"),
        "approach_150_200": m.get("app_3"),
        "approach_200_plus": m.get("app_4"),
        "around_green_overall": m.get("around"),
        "around_green_fairway": m.get("arg_1"),
        "around_green_rough": m.get("arg_2"),
        "around_green_bunker": m.get("arg_3"),
        "putting_overall": m.get("putting"),
        "putting_2_5_feet": m.get("putt_1"),
        "putting_5_30": m.get("putt_2"),
        "putting_30_plus": m.get("putt_3"),
        "sg_driving": sg(v.get("driving")),
        "sg_approach": sg(v.get("approach")),
        "sg_around_green": sg(v.get("around")),
        "sg_putting": sg(v.get("putting")),
        "skills_updated_at": datetime.utcnow().isoformat(),
    }


# Name aliases for Data Golf search (DG uses different spellings)
NAME_ALIASES = {
    "Nicolas Echavarria": "Nico Echavarria",
    "Matthias Schmid": "Matti Schmid",
    "Erik Van Rooyen": "Erik van Rooyen",
}


def load_players_from_field_file(path: str) -> list[str]:
    """Load player names from CSV (first column, skip header)."""
    players = []
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            parts = line.split(",")
            name = parts[0].strip()
            if i == 0 and name.lower() in ("player", "name"):
                continue  # Skip header
            if name:
                name = NAME_ALIASES.get(name, name)
                players.append(name)
    return players


def load_players_from_tournament(tournament_id: str) -> list[str] | None:
    """Load player names from tournament_players (populated when odds are imported)."""
    r = (
        supabase.table("tournament_players")
        .select("pga_players(name)")
        .eq("tournament_id", tournament_id)
        .execute()
    )
    if r.error:
        return None
    players = []
    for row in r.data or []:
        pp = row.get("pga_players")
        if isinstance(pp, dict) and pp.get("name"):
            name = NAME_ALIASES.get(pp["name"], pp["name"])
            players.append(name)
    return players if players else None


def main():
    parser = argparse.ArgumentParser(description="Weekly update: tournament results + SG + skills")
    parser.add_argument("--tournament-id", type=str, help="Tournament UUID - use field from tournament_players (odds import)")
    parser.add_argument("--event", type=int, help="Data Golf event ID (e.g. 4 for Farmers)")
    parser.add_argument("--year", type=int, default=datetime.now().year)
    parser.add_argument("--field-file", type=str, help="CSV file with Player in first column (fallback)")
    parser.add_argument("--latest", action="store_true", help="Auto-detect most recent tournament")
    args = parser.parse_args()
    
    opts = Options()
    opts.add_argument("--no-sandbox")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--headless")
    driver = webdriver.Chrome(options=opts)
    
    # Get player list: tournament-id (preferred) > field-file > Data Golf past-results
    if args.tournament_id:
        print(f"Loading field from tournament_players (tournament_id={args.tournament_id})...")
        players = load_players_from_tournament(args.tournament_id)
        if not players:
            print("No players found for that tournament. Import odds first via /admin/odds.")
            driver.quit()
            return
        tournament = {"name": "Tournament Field", "date": ""}
        print(f"Players: {len(players)}\n")
    elif args.field_file:
        if not os.path.exists(args.field_file):
            print(f"Field file not found: {args.field_file}")
            driver.quit()
            return
        players = load_players_from_field_file(args.field_file)
        tournament = {"name": "Field List", "date": ""}
        print(f"Using field file: {args.field_file}")
        print(f"Players: {len(players)}\n")
    else:
        # Resolve event/year
        if args.event is not None:
            event_id, year = args.event, args.year
            print(f"Using tournament: event_id={event_id}, year={year}")
        else:
            print("Auto-detecting most recent PGA tournament...")
            result = get_latest_pga_tournament(driver)
            if not result:
                print("Could not detect a completed tournament. Use --event and --year or --field-file.")
                driver.quit()
                return
            event_id, year = result
            print(f"Detected: event_id={event_id}, year={year}")
        
        # Fetch field from past-results
        print("Fetching field from past-results...")
        field_result = fetch_field_from_past_results(driver, event_id, year)
        if not field_result:
            print("No data found. Tournament may not be completed yet.")
            driver.quit()
            return
        
        players, tournament = field_result
        print(f"Tournament: {tournament['name']} ({tournament['date']})")
        print(f"Players: {len(players)}\n")
    
    tourn_ok = 0
    skills_ok = 0
    
    try:
        for i, name in enumerate(players):
            print(f"[{i+1}/{len(players)}] {name}", end=" ", flush=True)
            
            pid = get_player_id(name)
            if not pid:
                print("- ❌ Not in DB", flush=True)
                continue
            
            data = scrape_player(driver, name)
            if not data:
                print("- ⚠️ No data", flush=True)
                continue
            
            # Tournament records
            records = process_tournament_records(data.get("new_data", []), pid)
            if records:
                try:
                    supabase.table("historical_tournament_results").upsert(
                        records,
                        on_conflict="pga_player_id,tournament_name,tournament_date",
                    ).execute()
                    tourn_ok += 1
                except Exception as e:
                    if "on_conflict" in str(e).lower():
                        supabase.table("historical_tournament_results").upsert(records).execute()
                    tourn_ok += 1
            
            # Skills
            skills = process_skills(data.get("reload_data"))
            if skills:
                supabase.table("pga_players").update(skills).eq("id", pid).execute()
                skills_ok += 1
            
            status = []
            if records:
                status.append(f"T:{len(records)}")
            if skills:
                status.append(f"S:{skills.get('approach_overall')}")
            print(f"- {' '.join(status)}" if status else "-", flush=True)
            
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n\nStopped by user", flush=True)
    finally:
        driver.quit()
    
    print("\n" + "=" * 50)
    print("WEEKLY UPDATE COMPLETE")
    print("=" * 50)
    print(f"✅ Tournament records updated: {tourn_ok}")
    print(f"✅ Skill profiles refreshed: {skills_ok}")


if __name__ == "__main__":
    main()
