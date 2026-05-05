import { useState } from 'react';
export default function KanbanBoard() {
  const [v, setV] = useState('');
  const SortSelect = ({ col }) => (
    <select value={col} onChange={(e) => setV(e.target.value)}>
      <option value="a">Test</option>
    </select>
  );
  return <div><SortSelect col={v} /></div>;
}
