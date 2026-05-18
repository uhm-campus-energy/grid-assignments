
import GridMap from '../components/map/GridMap';
import { GridAssignment } from '../types/gridAssignment';
import { IT_CENTER_X_RANGE, IT_CENTER_Y_RANGE } from '../components/map/mapConstants';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAssignment } from '../api/gridMap';

interface ITCenterTabProps {
  data: GridAssignment[];
  scenario: string;
}

export default function ITCenterTab({ data, scenario }: ITCenterTabProps) {
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
      xRange={IT_CENTER_X_RANGE as [number, number]}
      yRange={IT_CENTER_Y_RANGE as [number, number]}
      onReassign={(meterName, newBus) => {
        mutation.mutate({ meterName, newBus });
      }}
    />
  );
}
