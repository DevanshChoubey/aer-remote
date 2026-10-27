import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { Linking } from 'react-native';

import { t } from '@/i18n';
import { useThemePreference, type ThemePreference } from '@/theme';
import { Button, Card, Chip, Column, Input, Row, Screen, Toggle, Touchable, Txt } from '@/ui';

import { useSettings } from './useSettings';
import { filterZones, listTimeZones, phoneZone, zonesFirst } from './zones';

const THEMES: { value: ThemePreference; key: string }[] = [
  { value: 'system', key: 'settings.themeSystem' },
  { value: 'light', key: 'settings.themeLight' },
  { value: 'dark', key: 'settings.themeDark' },
  { value: 'slate', key: 'settings.themeSlate' },
];

const MAX_SHOWN = 50;

export function SettingsScreen(): ReactElement {
  const router = useRouter();
  const { preference, setPreference } = useThemePreference();
  const { dispensers, setZone, errorKey, alertsOn, alertPermission, setAlertsOn } = useSettings();
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const zones = useMemo(() => listTimeZones(), []);
  const picking = dispensers.find((d) => d.id === pickingId) ?? null;
  const currentZone = picking?.homeTimeZone ?? '';
  const found = filterZones(zonesFirst(zones, [currentZone, phoneZone()]), query);
  const matches = found.slice(0, MAX_SHOWN);

  if (picking) {
    return (
      <Screen
        title={t('settings.zoneTitle', { name: picking.name })}
        scroll
        onBack={() => {
          setPickingId(null);
          setQuery('');
        }}
      >
        <Column gap={3}>
          <Txt color="muted">{t('settings.zoneCurrent', { zone: picking.homeTimeZone })}</Txt>
          <Txt variant="caption" color="muted">
            {t('settings.zoneHint')}
          </Txt>
          {errorKey ? <Txt color="warn">{t(errorKey)}</Txt> : null}
          <Input
            value={query}
            onChangeText={setQuery}
            accessibilityLabel={t('settings.zoneSearch')}
            placeholder={t('settings.zoneSearch')}
          />
          {matches.length === 0 ? <Txt color="muted">{t('settings.zoneNone')}</Txt> : null}
          {found.length > MAX_SHOWN ? (
            <Txt variant="caption" color="muted">
              {t('settings.zoneCapped', { count: MAX_SHOWN })}
            </Txt>
          ) : null}
          {matches.map((zone) => (
            <Touchable
              key={zone}
              accessibilityLabel={zone}
              selected={zone === picking.homeTimeZone}
              onPress={() => {
                void setZone(picking.id, zone).then((ok) => {
                  if (ok) {
                    setPickingId(null);
                    setQuery('');
                  }
                });
              }}
            >
              <Txt variant={zone === picking.homeTimeZone ? 'bodyBold' : 'body'}>{zone}</Txt>
            </Touchable>
          ))}
        </Column>
      </Screen>
    );
  }

  return (
    <Screen title={t('settings.title')} scroll onBack={() => router.back()}>
      <Column gap={4}>
        <Card>
          <Txt variant="heading">{t('settings.theme')}</Txt>
          <Row gap={2} wrap>
            {THEMES.map((o) => (
              <Chip
                key={o.value}
                label={t(o.key)}
                state={preference === o.value ? 'selected' : 'neutral'}
                onToggle={() => setPreference(o.value)}
              />
            ))}
          </Row>
        </Card>
        <Card>
          <Toggle
            label={t('settings.alerts')}
            value={alertsOn}
            onChange={(on) => void setAlertsOn(on)}
          />
          <Txt variant="caption" color="muted">
            {t('settings.alertsHint')}
          </Txt>
          {alertPermission === 'denied' ? (
            <>
              <Txt color="warn">{t('settings.alertsDenied')}</Txt>
              <Button
                variant="secondary"
                label={t('settings.alertsOpenSettings')}
                onPress={() => {
                  Linking.openSettings().catch((e: unknown) =>
                    console.warn('Could not open the phone settings', e),
                  );
                }}
              />
            </>
          ) : null}
        </Card>
        <Card>
          <Txt variant="heading">{t('settings.dispensers')}</Txt>
          {dispensers.length === 0 ? <Txt color="muted">{t('settings.noDispensers')}</Txt> : null}
          {dispensers.map((d) => (
            <Touchable
              key={d.id}
              accessibilityLabel={t('settings.zoneRow', { name: d.name, zone: d.homeTimeZone })}
              onPress={() => setPickingId(d.id)}
            >
              <Column gap={1}>
                <Txt variant="bodyBold">{d.name}</Txt>
                <Txt variant="caption" color="muted">
                  {d.homeTimeZone}
                </Txt>
              </Column>
            </Touchable>
          ))}
        </Card>
        <Card>
          <Txt variant="heading">{t('settings.about')}</Txt>
          <Txt variant="bodyBold">{t('settings.unofficialNotice')}</Txt>
          <Txt>{t('settings.worksWith')}</Txt>
          <Txt color="muted">{t('settings.offlineNote')}</Txt>
          <Txt>{t('settings.licenceBody')}</Txt>
          <Txt variant="caption" color="muted">
            {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
          </Txt>
        </Card>
      </Column>
    </Screen>
  );
}
