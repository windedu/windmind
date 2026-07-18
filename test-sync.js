import { createClient } from '@supabase/supabase-js';
import * as Y from 'yjs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const roomId = 'test-room-123';
const channel = supabase.channel(`mindmap-${roomId}`, {
  config: { broadcast: { self: false, ack: false } },
});

channel.on('broadcast', { event: 'yjs-update' }, (payload) => {
  console.log('Received broadcast payload:', payload);
}).subscribe(status => {
  console.log('Channel status:', status);
  if (status === 'SUBSCRIBED') {
    channel.send({
      type: 'broadcast',
      event: 'yjs-update',
      payload: { update: 'test' }
    }).then(res => console.log('Send res:', res)).catch(err => console.log('Send err:', err));
  }
});
