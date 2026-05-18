
import AssignmentTable from '../components/table/AssignmentTable';
import { GridAssignment } from '../types/gridAssignment';

interface ListTabProps {
  data: GridAssignment[];
}

export default function ListTab({ data }: ListTabProps) {
  return <AssignmentTable data={data} />;
}
