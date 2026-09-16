// Identity only, safe to import from a client component. System prompts live
// in boardPersonas.js so they never ship to the browser.

export const BOARD_SEATS = [
  { id: 'chair', title: 'Chair', short: 'Chair', lens: 'Runs the meeting, forces a call' },
  { id: 'cfo', title: 'CFO', short: 'CFO', lens: 'Cash, runway, unit economics' },
  { id: 'cmo', title: 'CMO', short: 'CMO', lens: 'Demand, positioning, brand' },
  { id: 'coo', title: 'COO', short: 'COO', lens: 'Capacity and execution' },
  { id: 'cto', title: 'CTO', short: 'CTO', lens: 'What is actually buildable' },
  { id: 'cso', title: 'CSO', short: 'CSO', lens: 'The three-to-five year view' },
  { id: 'cro', title: 'CRO', short: 'CRO', lens: 'Downside and tail risk' },
  { id: 'investor', title: 'Investor', short: 'Inv', lens: 'Outside capital, dilution' },
];

export const DEBATING_SEATS = BOARD_SEATS.filter((s) => s.id !== 'chair');

export const SEAT_BY_ID = Object.fromEntries(BOARD_SEATS.map((s) => [s.id, s]));
