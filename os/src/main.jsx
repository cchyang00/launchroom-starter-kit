import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './compact.css';
import './desk.css';
import './planner.css';
import {Launchroom} from './Launchroom.jsx';
import './launchroom.css';
import './theme.css';
import './tokens.css';
import {startAppearance} from './appearance.mjs';
// Apply the saved scheme and mode before first paint (per browser; the signed-in person's
// own choice is applied once the session is known, in Launchroom.jsx).
startAppearance();
createRoot(document.getElementById('root')).render(<React.StrictMode><Launchroom /></React.StrictMode>);
