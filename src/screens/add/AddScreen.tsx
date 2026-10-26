import { useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';

import { useServices } from '@/core';
import { t } from '@/i18n';
import { Button, Card, Column, Input, Row, Screen, Txt } from '@/ui';

import { errorCopyKey } from '../errorCopy';

import { useScan, type FoundDispenser } from './useScan';

const NEAR_DBM = -60;
const FAR_DBM = -75;

function signalKey(rssi: number | null): string {
  if (rssi === null || rssi < FAR_DBM) return 'add.signalFar';
  return rssi >= NEAR_DBM ? 'add.signalClose' : 'add.signalNear';
}

export function AddScreen(): ReactElement {
  const router = useRouter();
  const { client } = useServices();
  const scan = useScan();
  const [chosen, setChosen] = useState<FoundDispenser | null>(null);
  const [name, setName] = useState(t('add.defaultName'));
  const [blinking, setBlinking] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  const blink = async (id: string): Promise<void> => {
    setActionError(null);
    setBlinking(id);
    try {
      await client.blink(id, Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (e) {
      setActionError(e);
    } finally {
      setBlinking(null);
    }
  };

  const choose = (d: FoundDispenser): void => {
    scan.stop();
    setActionError(null);
    setChosen(d);
  };

  const save = async (d: FoundDispenser): Promise<void> => {
    setActionError(null);
    setSaving(true);
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const saved = await client.add(d.id, name.trim() || t('add.defaultName'), zone);
      router.replace(`/dispenser/${saved.id}`);
    } catch (e) {
      setActionError(e);
      setSaving(false);
    }
  };

  const errorLine = actionError ? <Txt color="warn">{t(errorCopyKey(actionError))}</Txt> : null;

  if (chosen) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen title={t('add.nameTitle')} scroll>
          <Column gap={4}>
            <Txt color="muted">{t('add.nameLabel')}</Txt>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t('add.namePlaceholder')}
              accessibilityLabel={t('add.nameLabel')}
              onSubmitEditing={() => void save(chosen)}
            />
            {errorLine}
            <Button label={t('add.confirm')} onPress={() => void save(chosen)} loading={saving} />
            <Button
              variant="ghost"
              label={t('add.differentOne')}
              disabled={saving}
              onPress={() => {
                setChosen(null);
                scan.start();
              }}
            />
          </Column>
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  return (
    <Screen title={t('add.title')} scroll>
      <Txt color="muted">{t('add.intro')}</Txt>
      {scan.status === 'scanning' ? (
        <Row gap={3} align="center">
          <ActivityIndicator accessibilityLabel={t('add.scanning')} />
          <Txt>{t('add.scanning')}</Txt>
        </Row>
      ) : null}
      {scan.status === 'error' ? (
        <Column gap={3}>
          <Txt color="warn">{t(errorCopyKey(scan.error))}</Txt>
          <Button label={t('common.retry')} onPress={scan.start} />
        </Column>
      ) : null}
      {scan.devices.length > 0 ? (
        <Column gap={3}>
          <Txt variant="heading">{t('add.found')}</Txt>
          <Txt color="muted">{t('add.blinkHint')}</Txt>
          {scan.devices.map((d, i) => {
            const label = t('add.deviceName', { n: i + 1 });
            return (
              <Card key={d.id}>
                <Txt variant="bodyBold">{label}</Txt>
                <Txt variant="caption" color="muted">
                  {t(signalKey(d.rssi))}
                </Txt>
                <Row gap={2} wrap>
                  <Button
                    variant="secondary"
                    label={t('add.blink')}
                    accessibilityLabel={t('add.blinkLabel', { name: label })}
                    loading={blinking === d.id}
                    disabled={blinking !== null}
                    onPress={() => void blink(d.id)}
                  />
                  <Button
                    label={t('add.useThis')}
                    accessibilityLabel={t('add.pick', { name: label })}
                    onPress={() => choose(d)}
                  />
                </Row>
              </Card>
            );
          })}
          {errorLine}
        </Column>
      ) : null}
      {scan.showHelp ? <Txt>{t('add.help')}</Txt> : null}
      {scan.status === 'done' ? (
        <Button variant="secondary" label={t('add.lookAgain')} onPress={scan.start} />
      ) : null}
    </Screen>
  );
}
