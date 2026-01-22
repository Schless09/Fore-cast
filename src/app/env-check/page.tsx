import { validateEnvVars } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

/**
 * Development-only page to check environment variables
 * Access at /env-check
 */
export default function EnvCheckPage() {
  const validation = validateEnvVars();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables Check</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className={`text-lg font-semibold ${validation.valid ? 'text-green-600' : 'text-red-600'}`}>
                Status: {validation.valid ? '✅ Valid' : '❌ Invalid'}
              </p>
            </div>

            {validation.issues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-medium text-red-800 mb-2">Issues Found:</p>
                <ul className="list-disc list-inside text-red-700 space-y-1">
                  {validation.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-gray-800 mb-2">Environment Variables:</p>
              <div className="space-y-2 text-sm font-mono">
                <div>
                  <span className="text-gray-600">NEXT_PUBLIC_SUPABASE_URL:</span>{' '}
                  <span className={process.env.NEXT_PUBLIC_SUPABASE_URL ? 'text-green-600' : 'text-red-600'}>
                    {process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>{' '}
                  <span className={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'text-green-600' : 'text-red-600'}>
                    {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                      ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`
                      : 'MISSING'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-medium text-blue-800 mb-2">Instructions:</p>
              <ol className="list-decimal list-inside text-blue-700 space-y-1 text-sm">
                <li>Check your <code className="bg-blue-100 px-1 rounded">.env</code> or <code className="bg-blue-100 px-1 rounded">.env.local</code> file in the project root</li>
                <li>Ensure <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> is set to your Supabase project URL</li>
                <li>Ensure <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> is set to your Supabase anon/public key</li>
                <li>Get your keys from: Supabase Dashboard → Project Settings → API</li>
                <li>Restart your Next.js dev server after updating your environment file</li>
                <li><strong>Note:</strong> Both <code className="bg-blue-100 px-1 rounded">.env</code> and <code className="bg-blue-100 px-1 rounded">.env.local</code> work, but <code className="bg-blue-100 px-1 rounded">.env.local</code> is recommended (automatically ignored by git)</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
