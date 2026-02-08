-- Allow users to delete their own DM messages
CREATE POLICY "Users can delete own messages"
  ON conversation_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid()::text);
