-- Allow users to update their own league messages (edit content)
CREATE POLICY "Users can update own messages"
  ON league_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
