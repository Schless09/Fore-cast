'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import seedData from './seed-data.json';

export default function AdminTournamentsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    course: '',
    start_date: '',
    end_date: '',
    status: 'upcoming',
    livegolfapi_event_id: '',
  });

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          course: formData.course || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          status: formData.status,
          livegolfapi_event_id: formData.livegolfapi_event_id || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create tournament');
      }

      setMessage(`Tournament "${formData.name}" created successfully!`);
      setFormData({
        name: '',
        course: '',
        start_date: '',
        end_date: '',
        status: 'upcoming',
        livegolfapi_event_id: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create tournament');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL tournaments? This action cannot be undone and will also delete all related rosters and player data.')) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tournaments', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete tournaments');
      }

      setMessage('All tournaments deleted successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to delete tournaments');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkImport = async () => {
    if (!confirm(`Import ${seedData.length} tournaments? This will create all tournaments from the 2026 season.`)) {
      return;
    }

    setIsImporting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tournaments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournaments: seedData }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import tournaments');
      }

      setMessage(`Successfully imported ${result.count} tournaments!`);
      // Refresh the page to show new tournaments
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to import tournaments');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Manage Tournaments
        </h1>
        <p className="text-gray-600">
          Create and manage PGA Tour tournaments
        </p>
      </div>

      {/* Delete All */}
      <Card className="mb-6 border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Delete all tournaments from the database. This will also delete all related rosters and player data.
          </p>
          <Button
            onClick={handleDeleteAll}
            isLoading={isDeleting}
            disabled={isDeleting}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete All Tournaments'}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk Import */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bulk Import 2026 Season</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Import all tournaments from the 2026 PGA Tour season. This includes:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 mb-4 space-y-1">
            <li>American Express, Farmers Insurance, AT&T Pro-AM, WM Phoenix Open, Genesis Open</li>
            <li>Cognizant Classic, Arnold Palmer, PLAYERS Championship, Valspar, Houston Open</li>
            <li>Valero, Masters, RBC Heritage, Zurich Classic, Miami Championship</li>
            <li>Truist, PGA Championship, Byron Nelson, Charles Schwab, Memorial</li>
            <li>RBC Canadian, US Open, Travelers, John Deere, Scottish Open, British Open</li>
            <li>3M Open, Rocket Mortgage, Wyndham, FedEx St. Jude, BMW, Tour Championship</li>
          </ul>
          <Button
            onClick={handleBulkImport}
            isLoading={isImporting}
            disabled={isImporting || isDeleting}
          >
            {isImporting ? 'Importing...' : `Import ${seedData.length} Tournaments`}
          </Button>
        </CardContent>
      </Card>

      {/* Create Tournament Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTournament} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}

            {message && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg">
                {message}
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Tournament Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
                placeholder="e.g., The Masters"
              />
            </div>

            <div>
              <label
                htmlFor="course"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Course Name (Optional)
              </label>
              <input
                id="course"
                type="text"
                value={formData.course}
                onChange={(e) =>
                  setFormData({ ...formData, course: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
                placeholder="e.g., Augusta National"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="start_date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date *
                </label>
                <input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="end_date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date *
                </label>
                <input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="livegolfapi_event_id"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                LiveGolfAPI Event ID (optional)
              </label>
              <input
                id="livegolfapi_event_id"
                type="text"
                value={formData.livegolfapi_event_id}
                onChange={(e) =>
                  setFormData({ ...formData, livegolfapi_event_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
                placeholder="e.g., 291e61c6-b1e4-49d6-a84e-99864e73a2be"
              />
              <p className="mt-1 text-xs text-gray-500">
                Used to pull leaderboards directly from LiveGolfAPI when available.
              </p>
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <Button type="submit" isLoading={isCreating} className="w-full">
              Create Tournament
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
