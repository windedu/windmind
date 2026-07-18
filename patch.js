const fs = require('fs');
const content = fs.readFileSync('src/hooks/useYjsSync.ts', 'utf8');
const search = `    // Supabase Realtime Broadcast & Auto-save
    const channel = supabase.channel(\`mindmap-\${roomId}\`, {
      config: { broadcast: { self: false, ack: false } },
    });
    
    channel.on('broadcast', { event: 'yjs-update' }, ({ payload }) => {`;

const replace = `    // Supabase Realtime Broadcast & Auto-save
    const channel = supabase.channel(\`mindmap-\${roomId}\`, {
      config: { broadcast: { self: false, ack: false } },
    });
    
    let isSubscribed = false;
    let pendingUpdates: string[] = [];

    channel.on('broadcast', { event: 'yjs-update' }, ({ payload }) => {`;

const search2 = `    }).subscribe();

    let timeoutId: any;
    let isSaving = false;
    const handleUpdate = (update: Uint8Array, origin: any) => {
      if (roomId === 'mindsync-default-room') return;

      if (origin !== 'supabase-broadcast') {
        const hex = Array.from(update).map(b => b.toString(16).padStart(2, '0')).join('');
        channel.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: { update: hex }
        }).catch(err => console.error('Failed to broadcast update', err));
      }`;

const replace2 = `    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        pendingUpdates.forEach(hex => {
          channel.send({
            type: 'broadcast',
            event: 'yjs-update',
            payload: { update: hex }
          }).catch(err => console.error('Failed to broadcast queued update', err));
        });
        pendingUpdates = [];
      }
    });

    let timeoutId: any;
    let isSaving = false;
    const handleUpdate = (update: Uint8Array, origin: any) => {
      if (roomId === 'mindsync-default-room') return;

      if (origin !== 'supabase-broadcast') {
        const hex = Array.from(update).map(b => b.toString(16).padStart(2, '0')).join('');
        if (isSubscribed) {
          channel.send({
            type: 'broadcast',
            event: 'yjs-update',
            payload: { update: hex }
          }).catch(err => console.error('Failed to broadcast update', err));
        } else {
          pendingUpdates.push(hex);
        }
      }`;

let newContent = content.replace(search, replace).replace(search2, replace2);
fs.writeFileSync('src/hooks/useYjsSync.ts', newContent);
console.log('patched');
