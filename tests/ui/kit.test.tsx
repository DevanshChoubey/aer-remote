import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { Button, Card, Chip, EmptyState, StatusBadge, Toggle } from '@/ui';

function wrap(node: React.ReactElement): React.ReactElement {
  return <ThemeProvider scheme="light">{node}</ThemeProvider>;
}

describe('ui kit', () => {
  it('Button fires onPress and is blocked while loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(wrap(<Button label="Spray now" onPress={onPress} />));
    await fireEvent.press(screen.getByLabelText('Spray now'));
    expect(onPress).toHaveBeenCalledTimes(1);
    await rerender(wrap(<Button label="Spray now" onPress={onPress} loading />));
    await fireEvent.press(screen.getByLabelText('Spray now'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Toggle is a labelled switch that reports changes', async () => {
    const onChange = jest.fn();
    await render(wrap(<Toggle label="Auto spray" value={false} onChange={onChange} />));
    const el = screen.getByLabelText('Auto spray');
    expect(el.props.accessibilityRole).toBe('switch');
    await fireEvent(el, 'valueChange', true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Chip toggles with a state-aware label', async () => {
    const onToggle = jest.fn();
    await render(wrap(<Chip label="Mon" state="selected" onToggle={onToggle} />));
    await fireEvent.press(screen.getByLabelText('Mon, selected'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('StatusBadge says low below the threshold and ok above it', async () => {
    const { rerender } = await render(wrap(<StatusBadge kind="battery" percent={12} />));
    expect(screen.getByLabelText('Battery 12 percent, low')).toBeTruthy();
    await rerender(wrap(<StatusBadge kind="refill" percent={80} />));
    expect(screen.getByLabelText('Refill 80 percent, ok')).toBeTruthy();
  });

  it('Card and EmptyState render their content', async () => {
    await render(
      wrap(
        <Card>
          <EmptyState title="Add your dispenser" body="Nothing here yet." />
        </Card>,
      ),
    );
    expect(screen.getByText('Add your dispenser')).toBeTruthy();
  });
});
