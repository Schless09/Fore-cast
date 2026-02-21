-- Reset the page view tracker to zero for everyone
-- Clears the admin/leagues/[id] tracker (tournaments, weekly, season visit counts)
-- Counts will start fresh from 0 as new page views are recorded
DELETE FROM page_views;
