import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, TextInput, ScrollView, FlatList } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { qrAPI, borrowingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { queueOfflineScan, getAllScans, clearSyncedScans, OfflineScan } from '../../services/db';
import { checkOnlineStatus, syncOfflineScans } from '../../services/syncService';

type ScanMode = 'verification' | 'borrowing' | 'returning';

export default function ScanScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.user_role === 'school_admin' || user?.user_role === 'super_admin';

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('verification');
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Offline states
  const [offlineScans, setOfflineScans] = useState<OfflineScan[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const loadQueue = () => {
    const list = getAllScans();
    setOfflineScans(list);
  };

  useEffect(() => {
    loadQueue();
    const checkNet = async () => {
      const net = await checkOnlineStatus();
      setIsOnline(net);
    };
    checkNet();
    const netInterval = setInterval(checkNet, 15000);
    return () => clearInterval(netInterval);
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (loading) return;
    setLoading(true);
    setScanning(false);

    try {
      // 1. Get GPS Location if available
      let latitude: number | undefined, longitude: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch { }

      // 2. Check if online
      const online = await checkOnlineStatus();
      setIsOnline(online);

      if (!online) {
        // Handle Offline Queuing
        if (scanMode === 'borrowing' && !studentId.trim()) {
          Alert.alert('Error Offline', 'ID Siswa wajib diisi untuk peminjaman offline!');
          return;
        }

        queueOfflineScan({
          qr_payload: data,
          scan_type: scanMode,
          student_id: scanMode === 'borrowing' ? Number(studentId.trim()) : null,
          latitude: latitude || null,
          longitude: longitude || null,
        });

        Alert.alert(
          'Offline Mode',
          'Scan berhasil disimpan offline! Transaksi akan disinkronkan otomatis saat terhubung ke internet.',
          [{ text: 'OK', onPress: () => loadQueue() }]
        );
        return;
      }

      // 3. Handle Online Scanning based on Mode
      let response;
      if (scanMode === 'verification') {
        response = await qrAPI.scan({ qr_payload: data, scan_type: 'verification', latitude, longitude });
        setResult({ type: 'verification', data: response.data.data });
      } else if (scanMode === 'borrowing') {
        if (!studentId.trim()) {
          Alert.alert('Error', 'ID Siswa wajib diisi untuk peminjaman cepat!');
          return;
        }
        response = await borrowingsAPI.quickBorrow({
          student_id: Number(studentId.trim()),
          qr_payload: data,
        });
        setResult({ type: 'borrowing', data: response.data.data });
      } else if (scanMode === 'returning') {
        response = await borrowingsAPI.quickReturn({
          qr_payload: data,
        });
        setResult({ type: 'returning', data: response.data.data });
      }
    } catch (err: any) {
      Alert.alert('Gagal Memproses', err.response?.data?.message || 'Kode QR tidak valid atau server tidak merespons');
    } finally {
      setLoading(false);
    }
  };

  const triggerManualSync = async () => {
    setIsSyncingQueue(true);
    try {
      await syncOfflineScans();
      loadQueue();
      Alert.alert('Sinkronisasi Selesai', 'Antrean offline berhasil diproses.');
    } catch (err) {
      Alert.alert('Gagal Sinkronisasi', 'Gagal memproses antrean. Pastikan internet Anda stabil.');
    } finally {
      setIsSyncingQueue(false);
    }
  };

  const triggerClearSynced = () => {
    clearSyncedScans();
    loadQueue();
  };

  const getPendingCount = () => offlineScans.filter((s) => s.sync_status === 'pending').length;

  if (!permission) return <View style={s.c}><ActivityIndicator color={Colors.primary400} /></View>;
  if (!permission.granted) return (
    <View style={s.center}><Ionicons name="camera-outline" size={64} color={Colors.surface500} />
      <Text style={s.perm}>Izin kamera diperlukan untuk memindai kode QR buku</Text>
      <TouchableOpacity style={s.btn} onPress={requestPermission}><Text style={s.btnT}>Izinkan Kamera</Text></TouchableOpacity>
    </View>
  );

  const renderQueueItem = ({ item }: { item: OfflineScan }) => {
    const statusIcons = {
      pending: <Ionicons name="time-outline" size={20} color={Colors.warning500} />,
      synced: <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success500} />,
      failed: <Ionicons name="alert-circle-outline" size={20} color={Colors.danger500} />,
    };

    const modeLabels = {
      verification: 'Verifikasi',
      borrowing: `Pinjam (Siswa: ${item.student_id})`,
      returning: 'Kembali',
      inventory: 'Inventaris',
      audit: 'Audit',
    };

    return (
      <View style={s.qItem}>
        <View style={s.qLeft}>
          {statusIcons[item.sync_status]}
          <View>
            <Text style={s.qTitle}>{modeLabels[item.scan_type]}</Text>
            <Text style={s.qPayload} numberOfLines={1}>{item.qr_payload}</Text>
            {item.error_message && (
              <Text style={s.qError}>{item.error_message}</Text>
            )}
          </View>
        </View>
        <Text style={s.qTime}>{new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={s.c} contentContainerStyle={{ flexGrow: 1 }}>
      {scanning ? (
        <View style={StyleSheet.absoluteFillObject}>
          <CameraView style={StyleSheet.absoluteFillObject} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleBarCodeScanned}>
            <View style={s.overlay}>
              <View style={s.modeBanner}>
                <Ionicons name="scan-outline" size={16} color={Colors.white} />
                <Text style={s.modeBannerText}>
                  {scanMode === 'verification' ? 'Mode: Verifikasi QR' : scanMode === 'borrowing' ? `Peminjaman (Siswa: ${studentId})` : 'Mode: Pengembalian Cepat'}
                </Text>
              </View>
              <View style={s.frame} />
              <Text style={s.scanT}>Arahkan kamera ke QR Code Buku</Text>
            </View>
          </CameraView>
          <TouchableOpacity style={s.cancel} onPress={() => setScanning(false)}><Text style={s.cancelT}>Batal</Text></TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary400} /><Text style={s.perm}>Memproses Scan...</Text></View>
      ) : result ? (
        <View style={s.res}>
          <View style={s.ok}><Ionicons name="checkmark-circle" size={28} color={Colors.success500} /><Text style={s.okT}>Proses Berhasil</Text></View>

          {result.type === 'verification' && (
            <View style={s.card}>
              <Text style={s.lbl}>JUDUL BUKU</Text>
              <Text style={s.val}>{result.data.book?.book_title}</Text>
              <Text style={s.sub}>{result.data.book?.author_name}</Text>
            </View>
          )}

          {result.type === 'borrowing' && (
            <View style={s.card}>
              <Text style={s.lbl}>PEMINJAMAN CEPAT SUKSES</Text>
              <Text style={s.val}>{result.data.book_title || 'Buku Berhasil Dipinjam'}</Text>
              <Text style={s.sub}>Siswa: {result.data.student_name || `ID ${studentId}`}</Text>
            </View>
          )}

          {result.type === 'returning' && (
            <View style={s.card}>
              <Text style={s.lbl}>PENGEMBALIAN CEPAT SUKSES</Text>
              <Text style={s.val}>{result.data.book_title || 'Buku Berhasil Dikembalikan'}</Text>
              <Text style={s.sub}>Status: Dikembalikan</Text>
            </View>
          )}

          <TouchableOpacity style={s.btn} onPress={() => { setResult(null); setScanning(true); }}><Text style={s.btnT}>Scan Lagi</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { backgroundColor: Colors.surface700, marginTop: Spacing.sm }]} onPress={() => setResult(null)}><Text style={s.btnT}>Kembali ke Menu</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={s.mainContainer}>
          {/* Online/Offline Status Indicator */}
          <View style={[s.netStatus, { backgroundColor: isOnline ? Colors.success500 + '15' : Colors.danger500 + '15' }]}>
            <Ionicons name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'} size={18} color={isOnline ? Colors.success500 : Colors.danger500} />
            <Text style={[s.netStatusText, { color: isOnline ? Colors.success500 : Colors.danger500 }]}>
              {isOnline ? 'Terhubung ke Server' : 'Mode Offline (Lokal)'}
            </Text>
          </View>

          <View style={s.hero}>
            <View style={s.icon}><Ionicons name="qr-code-outline" size={56} color={Colors.primary400} /></View>
            <Text style={s.title}>QR Code Scanner</Text>
            <Text style={s.desc}>Pindai QR code buku untuk peminjaman, pengembalian, atau verifikasi status.</Text>
          </View>

          {/* Mode Selector for Admins */}
          {isAdmin && (
            <View style={s.adminPanel}>
              <Text style={s.panelTitle}>Pilih Mode Scan</Text>
              <View style={s.modeGrid}>
                <TouchableOpacity style={[s.modeBtn, scanMode === 'verification' && s.activeMode]} onPress={() => setScanMode('verification')}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={scanMode === 'verification' ? Colors.white : Colors.surface300} />
                  <Text style={[s.modeBtnText, scanMode === 'verification' && s.activeModeText]}>Verifikasi</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.modeBtn, scanMode === 'borrowing' && s.activeMode]} onPress={() => setScanMode('borrowing')}>
                  <Ionicons name="book-outline" size={20} color={scanMode === 'borrowing' ? Colors.white : Colors.surface300} />
                  <Text style={[s.modeBtnText, scanMode === 'borrowing' && s.activeModeText]}>Pinjam</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.modeBtn, scanMode === 'returning' && s.activeMode]} onPress={() => setScanMode('returning')}>
                  <Ionicons name="arrow-undo-outline" size={20} color={scanMode === 'returning' ? Colors.white : Colors.surface300} />
                  <Text style={[s.modeBtnText, scanMode === 'returning' && s.activeModeText]}>Kembali</Text>
                </TouchableOpacity>
              </View>

              {/* Student ID input if borrowing mode is selected */}
              {scanMode === 'borrowing' && (
                <View style={s.inputContainer}>
                  <Text style={s.inputLabel}>ID Siswa (Anggota)</Text>
                  <View style={s.inputWrapper}>
                    <Ionicons name="person-outline" size={16} color={Colors.surface400} style={s.inputIcon} />
                    <TextInput
                      style={s.textInput}
                      placeholder="Masukkan ID/NIS Siswa..."
                      placeholderTextColor={Colors.surface400}
                      keyboardType="numeric"
                      value={studentId}
                      onChangeText={setStudentId}
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[s.btn, scanMode === 'borrowing' && !studentId.trim() && s.disabledBtn]}
            disabled={scanMode === 'borrowing' && !studentId.trim()}
            onPress={() => setScanning(true)}
          >
            <Ionicons name="scan" size={20} color={Colors.white} />
            <Text style={s.btnT}>Mulai Scan</Text>
          </TouchableOpacity>

          {/* Offline Queue Manager Accordion */}
          {isAdmin && (
            <View style={s.queueContainer}>
              <TouchableOpacity style={s.queueHeader} onPress={() => setShowQueue(!showQueue)} activeOpacity={0.8}>
                <View style={s.queueTitleRow}>
                  <Ionicons name="file-tray-full-outline" size={20} color={Colors.white} />
                  <Text style={s.queueTitle}>Antrean Offline</Text>
                  {getPendingCount() > 0 && (
                    <View style={s.qBadge}><Text style={s.qBadgeText}>{getPendingCount()}</Text></View>
                  )}
                </View>
                <Ionicons name={showQueue ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.surface300} />
              </TouchableOpacity>

              {showQueue && (
                <View style={s.queueContent}>
                  <View style={s.queueActions}>
                    <TouchableOpacity style={[s.qActionBtn, isSyncingQueue && s.disabledBtn]} disabled={isSyncingQueue} onPress={triggerManualSync}>
                      {isSyncingQueue ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="sync-outline" size={14} color={Colors.white} />}
                      <Text style={s.qActionText}>Sinkronkan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.qActionBtn, { backgroundColor: Colors.surface600 }]} onPress={triggerClearSynced}>
                      <Ionicons name="trash-outline" size={14} color={Colors.white} />
                      <Text style={s.qActionText}>Bersihkan</Text>
                    </TouchableOpacity>
                  </View>

                  {offlineScans.length > 0 ? (
                    <FlatList
                      data={offlineScans}
                      renderItem={renderQueueItem}
                      keyExtractor={(item, idx) => String(item.id || idx)}
                      scrollEnabled={false}
                    />
                  ) : (
                    <View style={s.qEmpty}>
                      <Ionicons name="folder-open-outline" size={28} color={Colors.surface500} />
                      <Text style={s.qEmptyText}>Antrean offline kosong.</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.surface900 },
  mainContainer: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, minHeight: 400 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modeBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary500, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, position: 'absolute', top: 50 },
  modeBannerText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  frame: { width: 260, height: 260, borderWidth: 3, borderColor: Colors.primary400, borderRadius: BorderRadius.xl },
  scanT: { color: Colors.white, fontSize: FontSize.md, fontWeight: '600', marginTop: Spacing.xl },
  cancel: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: Colors.danger500, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full },
  cancelT: { color: Colors.white, fontWeight: '700' },
  hero: { alignItems: 'center', textAlign: 'center', marginTop: Spacing.md },
  icon: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primary500 + '15', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.white },
  desc: { fontSize: FontSize.sm, color: Colors.surface300, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  adminPanel: { backgroundColor: Colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.surface600, gap: Spacing.md },
  panelTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.white },
  modeGrid: { flexDirection: 'row', gap: Spacing.sm },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.surface700, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surface600 },
  activeMode: { backgroundColor: Colors.primary500, borderColor: Colors.primary400 },
  modeBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.surface300 },
  activeModeText: { color: Colors.white },
  inputContainer: { gap: 6, marginTop: Spacing.xs },
  inputLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.surface300 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface700, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surface600, paddingHorizontal: Spacing.md },
  inputIcon: { marginRight: Spacing.sm },
  textInput: { flex: 1, height: 44, color: Colors.white, fontSize: FontSize.md },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary500, borderRadius: BorderRadius.lg, paddingVertical: Spacing.lg, width: '100%' },
  disabledBtn: { opacity: 0.5 },
  btnT: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  perm: { fontSize: FontSize.md, color: Colors.surface300, marginVertical: Spacing.xl, textAlign: 'center', lineHeight: 22 },
  res: { padding: Spacing.lg, gap: Spacing.lg },
  ok: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.success500 + '15', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  okT: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success500 },
  card: { backgroundColor: Colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.surface600 },
  lbl: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.surface400, marginBottom: 6, letterSpacing: 1 },
  val: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white },
  sub: { fontSize: FontSize.sm, color: Colors.surface300, marginTop: 4 },
  netStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, alignSelf: 'center', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full },
  netStatusText: { fontSize: FontSize.xs, fontWeight: '700' },

  // Offline Queue UI
  queueContainer: { backgroundColor: Colors.surface800, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.surface600, overflow: 'hidden' },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  queueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  queueTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  qBadge: { backgroundColor: Colors.warning500, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  qBadgeText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.surface900 },
  queueContent: { borderTopWidth: 1, borderTopColor: Colors.surface600, padding: Spacing.md, gap: Spacing.md },
  queueActions: { flexDirection: 'row', gap: Spacing.sm },
  qActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.primary500, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  qActionText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '700' },
  qEmpty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  qEmptyText: { fontSize: FontSize.xs, color: Colors.surface400 },
  qItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.surface700 },
  qLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  qTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  qPayload: { fontSize: FontSize.xs, color: Colors.surface400, marginTop: 2, width: '90%' },
  qError: { fontSize: FontSize.xs, color: Colors.danger500, marginTop: 2, fontWeight: '600' },
  qTime: { fontSize: FontSize.xs, color: Colors.surface400 },
});
