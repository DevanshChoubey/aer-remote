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
    expect(el.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(el);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getAllByLabelText('Auto spray')).toHaveLength(1);
  });

  it('Chip toggles and exposes selected through accessibility state', async () => {
    const onToggle = jest.fn();
    await render(wrap(<Chip label="Mon" state="selected" onToggle={onToggle} />));
    const el = screen.getByLabelText('Mon');
    expect(el.props.accessibilityRole).toBe('togglebutton');
    expect(el.props.accessibilityState.selected).toBe(true);
    await fireEvent.press(el);
    expect(onToggle).toHaveBeenCalled();
  });

  it('Chip without onToggle still exposes selected', async () => {
    await render(wrap(<Chip label="Tue" state="neutral" />));
    expect(screen.getByLabelText('Tue').props.accessibilityState.selected).toBe(false);
  });

  it('Button loading is busy', async () => {
    await render(wrap(<Button label="Save" onPress={() => undefined} loading />));
    expect(screen.getByLabelText('Save').props.accessibilityState.busy).toBe(true);
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
