import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';

import { t } from '@/i18n';
import { useThemePreference, type ThemePreference } from '@/theme';
import { Button, Card, Chip, Column, Input, Row, Screen, Touchable, Txt } from '@/ui';

import { useSettings } from './useSettings';
import { filterZones, listTimeZones } from './zones';

const THEMES: { value: ThemePreference; key: string }[] = [
  { value: 'system', key: 'settings.themeSystem' },
  { value: 'light', key: 'settings.themeLight' },
  { value: 'dark', key: 'settings.themeDark' },
];

const MAX_SHOWN = 50;

export function SettingsScreen(): ReactElement {
  const router = useRouter();
  const { preference, setPreference } = useThemePreference();
  const { dispensers, setZone, errorKey } = useSettings();
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const zones = useMemo(() => listTimeZones(), []);
  const matches = useMemo(() => filterZones(zones, query).slice(0, MAX_SHOWN), [zones, query]);
  const picking = dispensers.find((d) => d.id === pickingId) ?? null;

  if (picking) {
    return (
      <Screen title={t('settings.zoneTitle', { name: picking.name })} scroll>
        <Column gap={3}>
          <Button
            variant="ghost"
            label={t('common.back')}
            onPress={() => {
              setPickingId(null);
              setQuery('');
            }}
          />
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
    <Screen title={t('settings.title')} scroll>
      <Column gap={4}>
        <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
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
