interface Candidate {
  csvId: string;
  dedupKey: string;
  matchedTransactionIds: string[];
}

interface DuplicatesReviewTableProps {
  candidates: Candidate[];
  selectedIds: string[];
  onToggleId: (id: string) => void;
}

export default function DuplicatesReviewTable({
  candidates,
  selectedIds,
  onToggleId,
}: DuplicatesReviewTableProps) {
  return (
    <table className='w-full text-sm'>
      <thead>
        <tr>
          <th>Select</th>
          <th>CSV ID</th>
          <th>Matched Tx IDs</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((c) => (
          <tr key={c.csvId}>
            <td>
              <input
                type='checkbox'
                checked={selectedIds.includes(c.csvId)}
                onChange={() => onToggleId(c.csvId)}
              />
            </td>
            <td>{c.csvId}</td>
            <td>{c.matchedTransactionIds.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
