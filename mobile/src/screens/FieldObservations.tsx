import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Button, ErrorMessage, Input, TextButton } from '../components/ui';
import { FieldsMap } from '../map/FieldsMap';
import { isPointInsideField } from '../map/geometry';
import {
  AgriOpsApi,
  ApiError,
  type Field,
  type FieldCrop,
  type FieldObservation,
  type ObservationLocation,
  type ObservationPhoto,
} from '../services/agriOpsApi';
import {
  deleteObservationDraft,
  loadObservationDraft,
  saveObservationDraft,
} from '../services/secureDrafts';
import { deleteCachedPhoto } from '../services/tempFiles';
import { colors, layout } from '../theme';

type Props = { api: AgriOpsApi; field: Field; onBack: () => void };
const dateTime = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
const message = (error: unknown) => error instanceof Error ? error.message : 'Spróbuj ponownie.';

export function FieldObservations({ api, field, onBack }: Props) {
  const [crops, setCrops] = useState<FieldCrop[] | null>(null);
  const [crop, setCrop] = useState<FieldCrop | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    api.fieldCrops(field).then(result => {
      if (!current) return;
      setCrops(result);
      if (result.length === 1) setCrop(result[0]);
    }).catch(error => { if (current) setError(message(error)); });
    return () => { current = false; };
  }, [api, field, attempt]);

  return (
    <>
      <TextButton title="Wróć do pól" onPress={onBack} />
      <Text style={layout.title}>{field.nazwa}</Text>
      <Text style={layout.subtitle}>Obserwacje pola i zdjęcia</Text>
      {error ? <>
        <ErrorMessage message={error} />
        <TextButton title="Ponów pobieranie" onPress={() => { setError(''); setAttempt(attempt + 1); }} />
      </> : crops === null ? <ActivityIndicator accessibilityLabel="Pobieranie upraw" color={colors.accent} /> : null}
      {crops?.length === 0 && <Text style={layout.detail}>Brak otwartej karty pola. Otwórz cykl uprawy w AgriOps, aby dodać obserwację.</Text>}
      {crops && crops.length > 1 && (
        <>
          <Text style={layout.detail}>Wybierz cykl uprawy</Text>
          {crops.map(item => (
            <Button key={item.fieldCropId} title={`${item.cropName || 'Cykl uprawy'} · od ${item.activeFrom}`}
              disabled={item.fieldCropId === crop?.fieldCropId} onPress={() => setCrop(item)} />
          ))}
        </>
      )}
      {crop && <ObservationEditor key={crop.fieldCropId} api={api} field={field} crop={crop} />}
    </>
  );
}

function ObservationEditor({ api, field, crop }: { api: AgriOpsApi; field: Field; crop: FieldCrop }) {
  const [items, setItems] = useState<FieldObservation[] | null>(null);
  const [listError, setListError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<ObservationPhoto | null>(null);
  const [location, setLocation] = useState<ObservationLocation | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loadedPhotos, setLoadedPhotos] = useState<Record<string, string>>({});
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    let current = true;
    loadObservationDraft(SecureStore, crop.farmId, crop.fieldCropId)
      .then(draft => {
        if (!current || !draft) return;
        setNote(draft.note);
        if (draft.latitude !== null && draft.longitude !== null) {
          setLocation({
            latitude: draft.latitude,
            longitude: draft.longitude,
            accuracy: draft.accuracy,
            source: draft.locationSource ?? 'gps',
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (current) setDraftLoaded(true); });
    return () => { current = false; };
  }, [crop.farmId, crop.fieldCropId]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (!note.trim() && !location) return;
    void saveObservationDraft(SecureStore, {
      farmId: crop.farmId,
      fieldId: crop.fieldId,
      fieldCropId: crop.fieldCropId,
      note,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      locationSource: location?.source ?? null,
      updatedAtUtc: new Date().toISOString(),
    }).catch(() => {});
  }, [crop.farmId, crop.fieldCropId, crop.fieldId, draftLoaded, location, note]);

  useEffect(() => {
    let current = true;
    api.observations(crop).then(result => { if (current) setItems(result); })
      .catch(error => { if (current) setListError(message(error)); });
    return () => { current = false; };
  }, [api, crop, attempt]);

  function refresh() {
    setListError('');
    setAttempt(value => value + 1);
  }

  async function pickPhoto(camera: boolean) {
    setBusy(true);
    setError('');
    setSaved(false);
    setCameraBlocked(false);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setCameraBlocked(!permission.canAskAgain);
          setError(
            permission.canAskAgain
              ? 'Brak zgody na aparat. Możesz wybrać zdjęcie z galerii.'
              : 'Dostęp do aparatu jest zablokowany w ustawieniach systemu. Otwórz ustawienia lub wybierz zdjęcie z galerii.',
          );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      const type = asset.mimeType ?? (/\.png$/i.test(asset.uri) ? 'image/png' :
        /\.webp$/i.test(asset.uri) ? 'image/webp' : /\.jpe?g$/i.test(asset.uri) ? 'image/jpeg' : '');
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
      if (!extension) {
        setError('Wybierz zdjęcie w formacie JPEG, PNG lub WebP.');
        return;
      }
      deleteCachedPhoto(photo?.uri);
      setPhoto({ uri: asset.uri, name: `obserwacja.${extension}`, type });
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function locate() {
    setBusy(true);
    setError('');
    setSaved(false);
    setLocationBlocked(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationBlocked(!permission.canAskAgain);
        setError(
          permission.canAskAgain
            ? 'Brak zgody na lokalizację. Możesz wskazać punkt ręcznie na mapie lub zapisać obserwację bez pozycji.'
            : 'Dostęp do lokalizacji jest zablokowany w ustawieniach systemu. Wskaż punkt na mapie lub otwórz ustawienia.',
        );
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
        accuracy: coords.accuracy,
        source: 'gps',
      });
    } catch {
      setError('Nie udało się ustalić pozycji GPS. Możesz wskazać miejsce ręcznie na mapie pola.');
    } finally {
      setBusy(false);
    }
  }

  function handleManualPoint(point: { latitude: number; longitude: number }) {
    setError('');
    setSaved(false);
    if (field.geometry && !isPointInsideField(field.geometry, point.latitude, point.longitude, 5)) {
      setError('Wybrany punkt znajduje się poza granicami pola. Dotknij miejsca wewnątrz granic pola.');
      return;
    }
    setLocation({
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: null,
      source: 'manual',
    });
  }

  async function loadPhotoPreview(observationId: string, photoId: string) {
    if (loadedPhotos[photoId] || loadingPhotoId) return;
    setLoadingPhotoId(photoId);
    setListError('');
    try {
      const dataUri = await api.observationPhotoDataUri(crop.farmId, observationId, photoId, true);
      setLoadedPhotos(current => ({ ...current, [photoId]: dataUri }));
    } catch (e) {
      setListError(message(e));
    } finally {
      setLoadingPhotoId(null);
    }
  }

  async function discardDraft() {
    deleteCachedPhoto(photo?.uri);
    setNote('');
    setPhoto(null);
    setLocation(null);
    setError('');
    await deleteObservationDraft(SecureStore, crop.farmId, crop.fieldCropId).catch(() => {});
  }

  async function save() {
    if (!photo || busy || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const sourcePrefix = location
        ? location.source === 'manual'
          ? '[Lokalizacja: punkt wskazany ręcznie na mapie]'
          : '[Lokalizacja: aktualny GPS]'
        : '';
      const finalNote = [note.trim(), sourcePrefix].filter(Boolean).join(' ');
      await api.createObservation(crop, finalNote, photo, location);
      await deleteObservationDraft(SecureStore, crop.farmId, crop.fieldCropId).catch(() => {});
      deleteCachedPhoto(photo.uri);
      setPhoto(null);
      setLocation(null);
      setNote('');
      setShowMapPicker(false);
      setSaved(true);
      refresh();
    } catch (error) {
      const rejected = error instanceof ApiError && error.status < 500;
      setError(rejected ? message(error) : `${message(error)} Szkic notatki i pozycji został zachowany lokalnie. Sprawdź listę obserwacji przed ponownym wysłaniem.`);
      if (!rejected) refresh();
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }

  return (
    <>
      <Text style={[layout.rowTitle, { marginVertical: 16 }]}>Nowa obserwacja</Text>
      <Input label="Notatka (opcjonalnie)" value={note} onChangeText={setNote} multiline maxLength={4000} editable={!busy} />
      <View style={[layout.toolbar, { marginTop: 0 }]}>
        <TextButton title="Zrób zdjęcie" disabled={busy} onPress={() => void pickPhoto(true)} />
        <TextButton title="Wybierz z galerii" disabled={busy} onPress={() => void pickPhoto(false)} />
        {cameraBlocked && <TextButton title="Ustawienia aparatu" onPress={() => void Linking.openSettings()} />}
      </View>
      {photo && <>
        <Image source={{ uri: photo.uri }} accessibilityLabel="Zdjęcie do obserwacji"
          style={styles.previewImage} resizeMode="contain" />
        <TextButton title="Usuń zdjęcie" disabled={busy} onPress={() => setPhoto(null)} />
      </>}
      <View style={[layout.toolbar, { marginTop: 0 }]}>
        <TextButton
          title="Dodaj lokalizację GPS"
          disabled={busy}
          onPress={() => void locate()}
        />
        <TextButton
          title={showMapPicker ? 'Ukryj mapę wyboru punktu' : 'Zaznacz punkt na mapie pola'}
          disabled={busy}
          onPress={() => setShowMapPicker(current => !current)}
        />
        {location && (
          <TextButton title="Usuń lokalizację" disabled={busy} onPress={() => setLocation(null)} />
        )}
        {locationBlocked && (
          <TextButton title="Ustawienia GPS" onPress={() => void Linking.openSettings()} />
        )}
      </View>
      {showMapPicker && (
        <FieldsMap
          fields={[field]}
          focus={{ fieldId: field.fieldId }}
          selectedPoint={location ? { latitude: location.latitude, longitude: location.longitude } : null}
          onSelectPoint={handleManualPoint}
        />
      )}
      {location && (
        <View style={styles.locationBadge}>
          <Text style={styles.badgeTitle}>
            {location.source === 'manual' ? 'Źródło: punkt wskazany ręcznie na mapie' : 'Źródło: aktualny GPS'}
          </Text>
          <Text style={layout.detail}>
            Współrzędne: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            {location.accuracy === null ? '' : ` · dokładność ok. ${Math.round(location.accuracy)} m`}
          </Text>
        </View>
      )}
      <Button title="Zapisz obserwację" disabled={busy || !photo} onPress={() => void save()} />
      {(note.trim() || location) && (
        <TextButton title="Wyczyść formularz i szkic" disabled={busy} onPress={() => void discardDraft()} />
      )}
      {!photo && !saved && <Text style={layout.detail}>Do zapisu potrzebne jest zdjęcie.</Text>}
      {busy && <ActivityIndicator accessibilityLabel="Trwa operacja" color={colors.accent} />}
      {saved && <Text accessibilityRole="alert" style={layout.detail}>Obserwacja została zapisana.</Text>}
      <ErrorMessage message={error} />
      <View style={[layout.heading, { marginTop: 24, marginBottom: 0 }]}>
        <Text style={[layout.rowTitle, layout.fill]}>Ostatnie obserwacje</Text>
        <TextButton title="Odśwież" onPress={refresh} />
      </View>
      <ErrorMessage message={listError} />
      {!listError && (items === null
        ? <ActivityIndicator accessibilityLabel="Pobieranie obserwacji" color={colors.accent} />
        : items.length === 0 && <Text style={layout.detail}>Brak obserwacji w tym cyklu.</Text>)}
      {items?.map(item => (
        <View key={item.observationId} style={layout.row}>
          <View style={layout.fill}>
            <Text style={layout.rowTitle}>{dateTime.format(new Date(item.observedAtUtc))}</Text>
            {item.note && <Text style={layout.detail}>{item.note}</Text>}
            {item.latitude != null && item.longitude != null && (
              <Text style={layout.detail}>
                Pozycja: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                {item.locationAccuracyMeters != null ? ` (±${Math.round(item.locationAccuracyMeters)} m)` : ' (wskazana na mapie)'}
              </Text>
            )}
            <Text style={layout.detail}>Zdjęcia: {item.photoCount}</Text>
            {item.photos?.map(photoItem => (
              <View key={photoItem.photoId} style={styles.photoBlock}>
                {loadedPhotos[photoItem.photoId] ? (
                  <Image
                    source={{ uri: loadedPhotos[photoItem.photoId] }}
                    accessibilityLabel={`Zapisane zdjęcie obserwacji ${photoItem.originalFileName}`}
                    style={styles.savedPhoto}
                    resizeMode="contain"
                  />
                ) : (
                  <TextButton
                    title={loadingPhotoId === photoItem.photoId ? 'Pobieranie zdjęcia…' : 'Pokaż zapisane zdjęcie'}
                    disabled={loadingPhotoId === photoItem.photoId}
                    onPress={() => void loadPhotoPreview(item.observationId, photoItem.photoId)}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  previewImage: { width: '100%', height: 180, borderRadius: 10 },
  savedPhoto: { width: '100%', height: 180, borderRadius: 10, marginTop: 8, backgroundColor: '#eef2eb' },
  photoBlock: { marginTop: 4 },
  locationBadge: {
    backgroundColor: '#eef5ea',
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badgeTitle: { color: colors.accent, fontWeight: '700', fontSize: 14, marginBottom: 2 },
});
