
import GridMap from '../components/map/GridMap';
import { GridAssignment } from '../types/gridAssignment';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAssignment } from '../api/gridMap';

interface GridMapMetersProps {
  data: GridAssignment[];
  scenario: string;
}

export default function GridMapMeters({ data, scenario }: GridMapMetersProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (vars: { meterName: string; newBus: string }) =>
      updateAssignment(vars.meterName, scenario, vars.newBus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grid-assignments'] });
    },
  });

  return (
    <GridMap
      data={data}
      scenario={scenario}
      showLabels={true}
      sizeBy="avg_kw_10_to_2"
      onReassign={(meterName, newBus) => {
        mutation.mutate({ meterName, newBus });
      }}
    />
  );
}
