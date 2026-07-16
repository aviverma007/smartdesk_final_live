// B1 — renders centred after the final row on Pages 2 and 3, only when the
// sheet has rows; never on empty states; never in the published PDF.
export default function EndOfSheetMarker({ colSpan }) {
  return (
    <tr>
      <td className="endmark" colSpan={colSpan}>- - x End of Sheet x - -</td>
    </tr>
  );
}
