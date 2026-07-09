import * as Y from 'yjs';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

// Extract roomId from URL
const pathParts = window.location.pathname.split('/');
export const roomId = pathParts.length >= 3 && pathParts[1] === 'map' ? pathParts[2] : 'mindsync-default-room';

export const doc = new Y.Doc();

// y-websocket provider removed as we use Supabase Realtime Broadcast
// Define our shared types
export const yNodesMap = doc.getMap('nodes');
export const yEdgesMap = doc.getMap('edges');
export const yCommentsMap = doc.getMap('comments');

export const undoManager = new Y.UndoManager([yNodesMap, yEdgesMap]);
