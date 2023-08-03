import Loading from '../Loading';

type TableDataLoadingSpinnerProps = {
  columnsCount: number;
};

export const TableDataLoadingSpinner: React.FC<TableDataLoadingSpinnerProps> =
  ({ columnsCount }) => (
    <tr>
      <td
        colSpan={columnsCount}
        style={{ textAlign: 'center', height: '50px' }}
      >
        <Loading />
      </td>
    </tr>
  );

TableDataLoadingSpinner.displayName = 'TableDataLoadingSpinner';
