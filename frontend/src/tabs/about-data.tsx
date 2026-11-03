const styles = {
  container: { padding: '20px', overflow: 'auto', height: '100%' },
  content: { maxWidth: '720px', fontSize: '14px', color: '#333', lineHeight: 1.6 },
  heading: {
    fontSize: '14px',
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    color: '#666',
    margin: '24px 0 8px',
  },
  p: { margin: '0 0 12px' },
  list: { margin: '4px 0 0', paddingLeft: '20px' },
};

// Where the demand and PV numbers on the Low Load, High PV tab come from.
export default function AboutData() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h2 style={{ ...styles.heading, marginTop: 0 }}>Building loads</h2>
        <p style={styles.p}>
          Building loads were taken from meters for the low load day of 1/1/2026 (for IT Center, which is
          no longer communicating, 1/1/25 was used).
        </p>

        <h2 style={styles.heading}>PV production</h2>
        <p style={styles.p}>
          High PV production was taken from 5/14/22 for Parking Structure Phase 2, and that data was used to
          estimate the production of the Parking Structure Phase 1 array, since we did not have data from
          when it was fully operational.
        </p>
        <p style={styles.p}>
          Other PV arrays are reflected in the building loads. For example, Gartley exports at some point
          during the day and its kW will be negative. Frog 1 and Frog 2 do the same.
        </p>

        <h2 style={styles.heading}>Missing meters</h2>
        Missing or broken meters not included in the analysis (we have no access to their data):
        <ul style={styles.list}>
          <li>Campus Center AC</li>
          <li>Law School AC</li>
          <li>Law School Clinic</li>
          <li>Edmonson Hall</li>
        </ul>
      </div>
    </div>
  );
}
