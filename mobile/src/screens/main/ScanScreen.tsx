import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, TextInput, ScrollView, FlatList, KeyboardAvoidingView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { qrAPI, borrowingsAPI, inventoryAPI, regionsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import { queueOfflineScan, getAllScans, clearSyncedScans, OfflineScan, getCachedBookById, getCachedStudentById, getCachedStudents } from '../../services/db';
import { checkOnlineStatus, syncOfflineScans } from '../../services/syncService';
import { useNetwork } from '../../context/NetworkContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

type ScanMode = 'verification' | 'borrowing' | 'returning';

export default function ScanScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('verification');
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Student search and selection states
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentSearchResults, setStudentSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Offline states
  const [offlineScans, setOfflineScans] = useState<OfflineScan[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const { isOnline } = useNetwork();

  // Advanced Inventory & Audit states
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceData, setTraceData] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Regional School Auditing search states
  const isHighAdmin = ['super_admin', 'regency_admin', 'district_admin'].includes(user?.user_role || '');
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [schoolSearchResults, setSchoolSearchResults] = useState<any[]>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);

  const searchSchools = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSchoolSearchResults([]);
      return;
    }
    setSchoolLoading(true);
    try {
      const res = await regionsAPI.listSchools({ q: query, limit: 20 });
      setSchoolSearchResults(res.data.data || []);
    } catch (err) {
      console.warn('Gagal mencari sekolah:', err);
    } finally {
      setSchoolLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (schoolSearchQuery.trim().length >= 2) {
        searchSchools(schoolSearchQuery);
      } else {
        setSchoolSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [schoolSearchQuery]);

  const searchStudents = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setStudentSearchResults([]);
      return;
    }
    setSearchLoading(true);
    
    const online = await checkOnlineStatus();
    if (online) {
      try {
        const res = await borrowingsAPI.searchStudent(query);
        setStudentSearchResults(res.data.data || []);
        setSearchLoading(false);
        return;
      } catch (err: any) {
        console.warn('Gagal mencari siswa online, mencoba pencarian lokal:', err);
      }
    }

    try {
      const localResults = getCachedStudents(query);
      setStudentSearchResults(localResults || []);
    } catch (err: any) {
      console.warn('Gagal mencari siswa dari cache lokal:', err);
      setStudentSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (studentSearchQuery.trim().length >= 2) {
        searchStudents(studentSearchQuery);
      } else {
        setStudentSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [studentSearchQuery]);

  const loadQueue = () => {
    const list = getAllScans();
    setOfflineScans(list);
  };

  const fetchAnomalies = async () => {
    if (!isAdmin) return;
    setLoadingAnomalies(true);
    try {
      const res = await inventoryAPI.getAnomalies();
      setAnomalies(res.data.data || []);
    } catch (err) {
      console.warn('Failed to fetch anomalies:', err);
    } finally {
      setLoadingAnomalies(false);
    }
  };

  useEffect(() => {
    loadQueue();

    if (isAdmin) {
      fetchAnomalies();
    }

    const unsubscribe = navigation?.addListener('focus', () => {
      loadQueue();
      if (isAdmin) {
        fetchAnomalies();
      }
    });

    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      if (unsubscribe) unsubscribe();
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [navigation, isAdmin]);

  const fetchTrace = async (qrId: number) => {
    setTraceLoading(true);
    try {
      const res = await inventoryAPI.getQrTrace(qrId);
      setTraceData(res.data.data);
    } catch (err: any) {
      console.warn('Trace fetch failed:', err);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (loading) return;
    setLoading(true);
    setScanning(false);

    try {
      // 1. Get GPS Location if available (optimized & fast lookup)
      let latitude: number | undefined, longitude: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const lastLoc = await Location.getLastKnownPositionAsync({});
          if (lastLoc) {
            latitude = lastLoc.coords.latitude;
            longitude = lastLoc.coords.longitude;
          } else {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
            latitude = loc.coords.latitude;
            longitude = loc.coords.longitude;
          }
        }
      } catch { }

      // 2. Check if online
      const online = await checkOnlineStatus();

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
        const scannedData = response.data.data;
        setResult({ type: 'verification', data: scannedData });

        // Trigger trace fetch automatically if book_qr is found
        const qrId = scannedData?.book_qr?.book_qr_id;
        if (qrId) {
          fetchTrace(qrId);
        }
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

  const handleUpdateStatus = async (status: string) => {
    const qrId = traceData?.book_qr_id || result?.data?.book_qr?.book_qr_id;
    if (!qrId) return;

    Alert.alert(
      'Konfirmasi Ubah Status',
      `Apakah Anda yakin ingin menandai buku ini sebagai "${status === 'active' ? 'Aktif' : status === 'damaged' ? 'Rusak' : 'Hilang'
      }"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Ubah',
          onPress: async () => {
            setLoading(true);
            try {
              await inventoryAPI.markQrStatus(qrId, status, noteText || undefined);
              Alert.alert('Sukses', 'Status QR code buku berhasil diperbarui.');
              setNoteText('');
              // Re-fetch traceability and anomalies lists
              await fetchTrace(qrId);
              fetchAnomalies();
            } catch (err: any) {
              Alert.alert('Gagal Perbarui Status', err.response?.data?.message || 'Terjadi kesalahan sistem');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRunAudit = async () => {
    const targetSchoolId = isHighAdmin ? selectedSchool?.school_id : (user?.school_id ?? undefined);
    if (isHighAdmin && !targetSchoolId) {
      Alert.alert('Pilih Sekolah', 'Silakan cari dan pilih sekolah tujuan terlebih dahulu!');
      return;
    }
    Alert.alert(
      'Konfirmasi Audit',
      'Audit stok akan mencocokkan data seluruh status fisik QR code buku dengan jumlah inventaris digital di perpustakaan sekolah Anda. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Jalankan Audit',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await inventoryAPI.runAudit(targetSchoolId);
              Alert.alert(
                'Audit Selesai',
                `Audit berhasil diselesaikan.\n\nBuku disinkronkan: ${res.data.data.synced_books}\nAnomali terdeteksi: ${res.data.data.anomalies?.length || 0}`
              );
              fetchAnomalies();
            } catch (err: any) {
              Alert.alert('Audit Gagal', err.response?.data?.message || 'Gagal menjalankan audit');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleInitializeStock = async () => {
    const targetSchoolId = isHighAdmin ? selectedSchool?.school_id : (user?.school_id ?? undefined);
    if (isHighAdmin && !targetSchoolId) {
      Alert.alert('Pilih Sekolah', 'Silakan cari dan pilih sekolah tujuan terlebih dahulu!');
      return;
    }
    Alert.alert(
      'PERINGATAN INISIALISASI',
      'Tindakan ini akan mengatur ulang total persediaan buku di sekolah Anda dan menghitung ulang seluruh data dari nol berdasarkan QR Code aktif yang valid. Apakah Anda yakin?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Inisialisasi',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await inventoryAPI.initializeStock(targetSchoolId);
              Alert.alert(
                'Inisialisasi Selesai',
                `Stok perpustakaan berhasil diinisialisasi ulang.\nTotal buku: ${res.data.data.initialized_books}`
              );
              fetchAnomalies();
            } catch (err: any) {
              Alert.alert('Inisialisasi Gagal', err.response?.data?.message || 'Gagal inisialisasi');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const triggerManualSync = async () => {
    setIsSyncingQueue(true);
    try {
      await syncOfflineScans();
      loadQueue();
      Alert.alert('Sinkronisasi Selesai', 'Antrean offline berhasil diproses.');
      fetchAnomalies();
    } catch (err) {
      Alert.alert('Gagal Sinkronisasi', 'Gagal memproses antrean. Pastikan internet Anda stabil.');
    } finally {
      setIsSyncingQueue(false);
    }
  };

  const handleResolveAnomaly = async (bookId: number) => {
    Alert.alert(
      'Selesaikan Anomali',
      'Apakah Anda yakin ingin menyelesaikan anomali persediaan ini? Jumlah total stok digital buku akan disesuaikan dengan jumlah QR code fisik yang terdaftar.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Selesaikan',
          style: 'destructive',
          onPress: async () => {
            setLoadingAnomalies(true);
            try {
              await inventoryAPI.deleteAnomaly(bookId);
              Alert.alert('Sukses', 'Anomali persediaan berhasil diselesaikan!');
              fetchAnomalies();
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message || 'Gagal menyelesaikan anomali');
            } finally {
              setLoadingAnomalies(false);
            }
          },
        },
      ]
    );
  };

  const getPendingCount = () => offlineScans.filter((s) => s.sync_status === 'pending').length;

  const handleStudentBorrow = async (bookQrId: number) => {
    setActionLoading(true);
    try {
      await borrowingsAPI.create({ book_qr_id: bookQrId });
      Alert.alert(
        'Pengajuan Sukses',
        'Pengajuan peminjaman berhasil dikirim! Menunggu persetujuan admin.',
        [{ text: 'OK', onPress: () => { setResult(null); setTraceData(null); } }]
      );
    } catch (err: any) {
      console.warn('Gagal mengajukan peminjaman:', err);
      const errMsg = err.response?.data?.message || 'Terjadi kesalahan saat mengajukan peminjaman';
      Alert.alert('Gagal Mengajukan', errMsg);
    } finally {
      setActionLoading(false);
    }
  };



  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <View style={[styles.badge, styles.badgeSuccess]}>
            <Text style={[styles.badgeText, { color: colors.success500 }]}>Tersedia</Text>
          </View>
        );
      case 'inactive':
        return (
          <View style={[styles.badge, styles.badgeDanger]}>
            <Text style={[styles.badgeText, { color: colors.danger500 }]}>Tidak Tersedia</Text>
          </View>
        );
      case 'damaged':
        return (
          <View style={[styles.badge, styles.badgeWarning]}>
            <Text style={[styles.badgeText, { color: colors.warning500 }]}>Rusak</Text>
          </View>
        );
      case 'lost':
        return (
          <View style={[styles.badge, styles.badgeDanger]}>
            <Text style={[styles.badgeText, { color: colors.danger500 }]}>Hilang</Text>
          </View>
        );
      case 'borrowed':
        return (
          <View style={[styles.badge, styles.badgeWarning]}>
            <Text style={[styles.badgeText, { color: colors.warning500 }]}>Dipinjam</Text>
          </View>
        );
      case 'maintenance':
        return (
          <View style={[styles.badge, styles.badgeSecondary]}>
            <Text style={[styles.badgeText, { color: colors.textMuted }]}>Perawatan</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, styles.badgeSecondary]}>
            <Text style={[styles.badgeText, { color: colors.textMuted }]}>{status}</Text>
          </View>
        );
    }
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator color={colors.primary400} /></View>;
  if (!permission.granted) return (
    <View style={styles.center}><Ionicons name="camera-outline" size={64} color={colors.surface500} />
      <Text style={styles.perm}>Izin kamera diperlukan untuk memindai kode QR buku</Text>
      <TouchableOpacity style={styles.btn} onPress={requestPermission}><Text style={styles.btnT}>Izinkan Kamera</Text></TouchableOpacity>
    </View>
  );

  const renderQueueItem = ({ item }: { item: OfflineScan }) => {
    const statusIcons = {
      pending: <Ionicons name="time-outline" size={20} color={colors.warning500} />,
      synced: <Ionicons name="checkmark-circle-outline" size={20} color={colors.success500} />,
      failed: <Ionicons name="alert-circle-outline" size={20} color={colors.danger500} />,
    };

    // 1. Resolve Book Name from payload
    let resolvedBookName = 'Buku Tidak Diketahui';
    try {
      const parsed = JSON.parse(item.qr_payload);
      if (parsed && parsed.book_id) {
        const cachedBook = getCachedBookById(parsed.book_id);
        if (cachedBook && cachedBook.book_title) {
          resolvedBookName = cachedBook.book_title;
        } else {
          resolvedBookName = parsed.book_title || parsed.serial || `Buku ID: ${parsed.book_id}`;
        }
      } else {
        resolvedBookName = item.qr_payload;
      }
    } catch {
      resolvedBookName = item.qr_payload;
    }

    // 2. Resolve Student Class Name
    let resolvedClassName = 'Kelas: Tidak Diketahui';
    if (item.student_id) {
      const cachedStudent = getCachedStudentById(item.student_id);
      if (cachedStudent && cachedStudent.class_name) {
        resolvedClassName = `Kelas: ${cachedStudent.class_name}`;
      } else {
        resolvedClassName = `Siswa ID: ${item.student_id}`;
      }
    } else {
      resolvedClassName = 'Verifikasi / Pengembalian';
    }

    return (
      <View style={styles.qItem}>
        <View style={styles.qLeft}>
          {statusIcons[item.sync_status]}
          <View style={{ flex: 1, paddingRight: Spacing.sm }}>
            <Text style={styles.qTitle}>{resolvedClassName}</Text>
            <Text style={styles.qPayload} numberOfLines={1}>
              {resolvedBookName}
            </Text>
            {item.error_message && (
              <Text style={styles.qError}>{item.error_message}</Text>
            )}
          </View>
        </View>
        <Text style={styles.qTime}>{new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={styles.safeContainer}>
        <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {scanning ? (
            <View style={StyleSheet.absoluteFillObject}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarCodeScanned}
              />
              <View style={styles.overlay}>
                <View style={styles.modeBanner}>
                  <Ionicons name="scan-outline" size={16} color={colors.white} />
                  <Text style={styles.modeBannerText}>
                    {scanMode === 'verification' ? 'Mode: Verifikasi QR' : scanMode === 'borrowing' ? `Peminjaman (Siswa: ${selectedStudent ? selectedStudent.full_name : studentId})` : 'Mode: Pengembalian Cepat'}
                  </Text>
                </View>
                <View style={styles.frame} />
                <Text style={styles.scanT}>Arahkan kamera ke QR Code Buku</Text>
              </View>
              <TouchableOpacity style={styles.cancel} onPress={() => setScanning(false)}><Text style={styles.cancelT}>Batal</Text></TouchableOpacity>
            </View>
          ) : loading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={colors.primary400} /><Text style={styles.perm}>Memproses Scan...</Text></View>
          ) : result ? (
            <View style={styles.res}>
              <View style={styles.ok}>
                <Ionicons name="checkmark-circle" size={28} color={colors.success500} />
                <Text style={styles.okT}>Proses Berhasil</Text>
              </View>

              {result.type === 'verification' && (
                <View style={{ gap: Spacing.md }}>
                  <View style={styles.card}>
                    <Text style={styles.lbl}>DETAIL QR BUKU</Text>
                    <Text style={styles.val}>{result.data?.book?.book_title || 'Unknown Book'}</Text>
                    <Text style={styles.sub}>Pengarang: {result.data?.book?.author_name || '-'}</Text>
                    <Text style={styles.sub}>Sekolah: {result.data?.book?.school?.school_name || '-'}</Text>
                  </View>

                  {!isAdmin && result.data?.book_qr && (
                    result.data?.scan_type === 'auto_return' ? (
                      <View style={styles.card}>
                        <Text style={[styles.lbl, { color: colors.success500 }]}>PENGEMBALIAN OTOMATIS SUKSES</Text>
                        <Text style={styles.val}>Buku Berhasil Dikembalikan</Text>
                        <Text style={styles.sub}>Buku "{result.data?.book?.book_title}" telah berhasil dikembalikan karena Anda memindai ulang buku yang sedang aktif Anda pinjam.</Text>
                        {result.data?.penalty_amount > 0 && (
                          <View style={{ marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                            <Ionicons name="wallet-outline" size={16} color={colors.danger500} />
                            <Text style={{ color: colors.danger500, fontWeight: '700', fontSize: FontSize.sm }}>
                              Denda Keterlambatan: Rp{Number(result.data.penalty_amount).toLocaleString('id-ID')}
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.card}>
                        <Text style={styles.lbl}>STATUS BUKU FISIK</Text>
                        <View style={styles.traceRow}>
                          <Text style={styles.traceLabel}>Serial:</Text>
                          <Text style={styles.traceVal}>{result.data.book_qr.qr_serial_number || '-'}</Text>
                        </View>
                        <View style={styles.traceRow}>
                          <Text style={styles.traceLabel}>Status:</Text>
                          {renderStatusBadge(result.data.book_qr.qr_status)}
                        </View>

                        {result.data.book_qr.qr_status === 'active' ? (
                          <View style={{ marginTop: Spacing.lg, gap: Spacing.md }}>
                            <TouchableOpacity
                              style={[styles.btn, actionLoading && styles.disabledBtn]}
                              disabled={actionLoading}
                              onPress={() => handleStudentBorrow(result.data.book_qr.book_qr_id)}
                            >
                              {actionLoading ? (
                                <ActivityIndicator size="small" color={colors.white} />
                              ) : (
                                <>
                                  <Ionicons name="book-outline" size={20} color={colors.white} />
                                  <Text style={styles.btnT}>Ajukan Peminjaman</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={[styles.ok, { backgroundColor: colors.danger500 + '15', marginTop: Spacing.md, alignSelf: 'stretch' }]}>
                            <Ionicons name="close-circle-outline" size={20} color={colors.danger500} />
                            <Text style={[styles.okT, { color: colors.danger500 }]}>Buku tidak tersedia untuk dipinjam</Text>
                          </View>
                        )}
                      </View>
                    )
                  )}

                  {isAdmin && (
                    <>
                      {traceLoading ? (
                        <View style={styles.loadingCard}>
                          <ActivityIndicator size="small" color={colors.primary400} />
                          <Text style={styles.loadingCardText}>Mengambil data traceability...</Text>
                        </View>
                      ) : traceData ? (
                        <View style={{ gap: Spacing.md }}>
                          {/* Status adjustments & Info Panel */}
                          <View style={styles.card}>
                            <Text style={styles.lbl}>INFO KONDISI FISIK & SCAN</Text>
                            <View style={styles.traceRow}>
                              <Text style={styles.traceLabel}>Serial:</Text>
                              <Text style={styles.traceVal}>{traceData.qr_serial_number || '-'}</Text>
                            </View>
                            <View style={styles.traceRow}>
                              <Text style={styles.traceLabel}>Status:</Text>
                              {renderStatusBadge(traceData.qr_status)}
                            </View>
                            <View style={styles.traceRow}>
                              <Text style={styles.traceLabel}>Scan Terakhir:</Text>
                              <Text style={styles.traceVal}>
                                {traceData.last_scanned_at ? new Date(traceData.last_scanned_at).toLocaleDateString('id-ID') : 'Belum pernah'}
                              </Text>
                            </View>
                            {traceData.last_scanned_by && (
                              <View style={styles.traceRow}>
                                <Text style={styles.traceLabel}>Oleh Admin:</Text>
                                <Text style={styles.traceVal}>{traceData.last_scanned_by.full_name}</Text>
                              </View>
                            )}

                            {/* Status adjustment buttons */}
                            <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
                              <Text style={styles.sectionSubtitle}>Sesuaikan Kondisi Buku (Update Status)</Text>
                              <View style={styles.inputWrapper}>
                                <Ionicons name="create-outline" size={16} color={colors.surface400} style={styles.inputIcon} />
                                <TextInput
                                  style={styles.textInput}
                                  placeholder="Masukkan catatan/alasan update..."
                                  placeholderTextColor={colors.surface400}
                                  value={noteText}
                                  onChangeText={setNoteText}
                                />
                              </View>
                              <View style={styles.adjustmentGrid}>
                                <TouchableOpacity
                                  style={[styles.adjustBtn, traceData.qr_status === 'active' && styles.disabledBtn, { backgroundColor: colors.success500 }]}
                                  disabled={traceData.qr_status === 'active'}
                                  onPress={() => handleUpdateStatus('active')}
                                >
                                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} />
                                  <Text style={styles.adjustBtnText}>Aktifkan</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[styles.adjustBtn, traceData.qr_status === 'damaged' && styles.disabledBtn, { backgroundColor: colors.warning500 }]}
                                  disabled={traceData.qr_status === 'damaged'}
                                  onPress={() => handleUpdateStatus('damaged')}
                                >
                                  <Ionicons name="alert-circle-outline" size={16} color={colors.white} />
                                  <Text style={styles.adjustBtnText}>Rusak</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[styles.adjustBtn, traceData.qr_status === 'lost' && styles.disabledBtn, { backgroundColor: colors.danger500 }]}
                                  disabled={traceData.qr_status === 'lost'}
                                  onPress={() => handleUpdateStatus('lost')}
                                >
                                  <Ionicons name="trash-outline" size={16} color={colors.white} />
                                  <Text style={styles.adjustBtnText}>Hilang</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>

                          {/* Borrowings history and scan log list */}
                          {traceData.borrowings && traceData.borrowings.length > 0 && (
                            <View style={styles.card}>
                              <Text style={styles.lbl}>RIWAYAT PEMINJAMAN TERAKHIR</Text>
                              {traceData.borrowings.slice(0, 5).map((b: any, index: number) => (
                                <View key={index} style={styles.logItem}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.logTitle}>{b.borrower?.full_name || 'Siswa'}</Text>
                                    <Text style={styles.logSub}>
                                      Pinjam: {new Date(b.created_at).toLocaleDateString('id-ID')}
                                    </Text>
                                  </View>
                                  <View style={[styles.badge, b.borrowing_status === 'returned' ? styles.badgeSuccess : styles.badgeWarning]}>
                                    <Text style={[styles.badgeText, { color: b.borrowing_status === 'returned' ? colors.success500 : colors.warning500 }]}>
                                      {b.borrowing_status === 'returned' ? 'Kembali' : 'Dipinjam'}
                                    </Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}

                          {traceData.scan_logs && traceData.scan_logs.length > 0 && (
                            <View style={styles.card}>
                              <Text style={styles.lbl}>LOG PEMINDAIAN TERAKHIR</Text>
                              {traceData.scan_logs.slice(0, 5).map((log: any, index: number) => (
                                <View key={index} style={styles.logItem}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.logTitle}>Scanned by {log.scanned_by?.full_name || 'Admin'}</Text>
                                    <Text style={styles.logSub}>
                                      Waktu: {new Date(log.scanned_at).toLocaleString('id-ID')}
                                    </Text>
                                  </View>
                                  <Text style={styles.logTypeBadge}>{log.scan_type}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              )}

              {result.type === 'borrowing' && (
                <View style={styles.card}>
                  <Text style={styles.lbl}>PEMINJAMAN CEPAT SUKSES</Text>
                  <Text style={styles.val}>{result.data.book_title || 'Buku Berhasil Dipinjam'}</Text>
                  <Text style={styles.sub}>Siswa: {result.data.student_name || `ID ${studentId}`}</Text>
                </View>
              )}

              {result.type === 'returning' && (
                <View style={styles.card}>
                  <Text style={styles.lbl}>PENGEMBALIAN CEPAT SUKSES</Text>
                  <Text style={styles.val}>{result.data.book_title || 'Buku Berhasil Dikembalikan'}</Text>
                  <Text style={styles.sub}>Status: Dikembalikan</Text>
                </View>
              )}

              <TouchableOpacity style={styles.btn} onPress={() => { setResult(null); setTraceData(null); setScanning(true); }}><Text style={styles.btnT}>Scan Lagi</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surface700, marginTop: Spacing.sm }]} onPress={() => { setResult(null); setTraceData(null); }}><Text style={styles.btnT}>Kembali ke Menu</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mainContainer}>
              {/* Online/Offline Status Indicator */}
              <View style={[styles.netStatus, { backgroundColor: isOnline ? colors.success500 + '15' : colors.danger500 + '15' }]}>
                <Ionicons name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'} size={18} color={isOnline ? colors.success500 : colors.danger500} />
                <Text style={[styles.netStatusText, { color: isOnline ? colors.success500 : colors.danger500 }]}>
                  {isOnline ? 'Terhubung ke Server' : 'Mode Offline'}
                </Text>
              </View>

              {!isKeyboardVisible && (
                <View style={styles.hero}>
                  <View style={styles.icon}><Ionicons name="qr-code-outline" size={56} color={colors.primary400} /></View>
                  <Text style={styles.title}>QR Code Scanner</Text>
                  <Text style={styles.desc}>Pindai QR code buku untuk peminjaman, pengembalian, atau verifikasi status.</Text>
                </View>
              )}

              {/* Mode Selector for Admins */}
              {isAdmin && (
                <View style={styles.adminPanel}>
                  <Text style={styles.panelTitle}>Pilih Mode Scan</Text>
                  <View style={styles.modeGrid}>
                    <TouchableOpacity style={[styles.modeBtn, scanMode === 'verification' && styles.activeMode]} onPress={() => setScanMode('verification')}>
                      <Ionicons name="shield-checkmark-outline" size={20} color={scanMode === 'verification' ? colors.white : colors.textMuted} />
                      <Text style={[styles.modeBtnText, scanMode === 'verification' && styles.activeModeText]}>Verifikasi</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.modeBtn, scanMode === 'borrowing' && styles.activeMode]} onPress={() => setScanMode('borrowing')}>
                      <Ionicons name="book-outline" size={20} color={scanMode === 'borrowing' ? colors.white : colors.textMuted} />
                      <Text style={[styles.modeBtnText, scanMode === 'borrowing' && styles.activeModeText]}>Pinjam</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.modeBtn, scanMode === 'returning' && styles.activeMode]} onPress={() => setScanMode('returning')}>
                      <Ionicons name="arrow-undo-outline" size={20} color={scanMode === 'returning' ? colors.white : colors.textMuted} />
                      <Text style={[styles.modeBtnText, scanMode === 'returning' && styles.activeModeText]}>Kembali</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Student ID input if borrowing mode is selected */}
                  {scanMode === 'borrowing' && (
                    <View style={styles.inputContainer}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                        <Text style={styles.inputLabel}>Cari Siswa (Anggota)</Text>
                        <TouchableOpacity onPress={() => { setShowManualInput(!showManualInput); setStudentSearchQuery(''); setSelectedStudent(null); setStudentId(''); setStudentSearchResults([]); }}>
                          <Text style={{ fontSize: FontSize.xs, color: colors.primary400, fontWeight: '700' }}>
                            {showManualInput ? 'Cari dari Database' : 'Input ID Manual'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {showManualInput ? (
                        <View style={styles.inputWrapper}>
                          <Ionicons name="keypad-outline" size={16} color={colors.surface400} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="Masukkan Database ID Siswa (Anggota)..."
                            placeholderTextColor={colors.surface400}
                            keyboardType="numeric"
                            value={studentId}
                            onChangeText={setStudentId}
                          />
                        </View>
                      ) : (
                        <View style={{ gap: Spacing.sm }}>
                          {selectedStudent ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: colors.success500 + '15', borderWidth: 1, borderColor: colors.success500 + '30', borderRadius: BorderRadius.md, padding: Spacing.md }}>
                              <View style={{ width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: colors.white, fontWeight: '700', fontSize: FontSize.md }}>
                                  {selectedStudent.full_name?.charAt(0)?.toUpperCase() || 'S'}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                                  {selectedStudent.full_name}
                                </Text>
                                <Text style={{ fontSize: FontSize.xs, color: colors.textMuted }}>
                                  {selectedStudent.class_name || 'Tanpa kelas'} · NISN: {selectedStudent.student_id_number || '-'}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 }}>
                                  <View style={{ backgroundColor: selectedStudent.active_borrowing_count > 0 ? colors.warning500 + '20' : colors.success500 + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ color: selectedStudent.active_borrowing_count > 0 ? colors.warning500 : colors.success500, fontSize: 10, fontWeight: '700' }}>
                                      {selectedStudent.active_borrowing_count} aktif
                                    </Text>
                                  </View>
                                </View>
                              </View>
                              <TouchableOpacity onPress={() => { setSelectedStudent(null); setStudentId(''); }}>
                                <Ionicons name="close-circle" size={22} color={colors.danger500} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <>
                              <View style={styles.inputWrapper}>
                                {searchLoading ? (
                                  <ActivityIndicator size="small" color={colors.primary400} style={{ marginRight: Spacing.sm }} />
                                ) : (
                                  <Ionicons name="search-outline" size={16} color={colors.surface400} style={styles.inputIcon} />
                                )}
                                <TextInput
                                  style={styles.textInput}
                                  placeholder="Nama, email, atau NISN siswa..."
                                  placeholderTextColor={colors.surface400}
                                  value={studentSearchQuery}
                                  onChangeText={setStudentSearchQuery}
                                />
                              </View>

                              {/* Search Results list */}
                              {studentSearchResults.length > 0 && (
                                <View style={{ backgroundColor: colors.surface800, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600, maxHeight: 160, overflow: 'hidden', padding: Spacing.xs }}>
                                  <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                                    {studentSearchResults.map((sItem, index) => (
                                      <TouchableOpacity
                                        key={`student-${sItem.user_id || index}-${index}`}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surface600 }}
                                        onPress={() => {
                                          setSelectedStudent(sItem);
                                          setStudentId(String(sItem.user_id));
                                          setStudentSearchResults([]);
                                          setStudentSearchQuery('');
                                        }}
                                      >
                                        <View style={{ width: 28, height: 28, borderRadius: BorderRadius.sm, backgroundColor: colors.primary500 + '30', alignItems: 'center', justifyContent: 'center' }}>
                                          <Text style={{ color: colors.primary400, fontWeight: '700', fontSize: FontSize.xs }}>
                                            {sItem.full_name?.charAt(0)?.toUpperCase() || 'S'}
                                          </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                          <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                                            {sItem.full_name}
                                          </Text>
                                          <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                            {sItem.class_name || 'Tanpa kelas'} · {sItem.student_id_number || 'Tanpa NISN'}
                                          </Text>
                                        </View>
                                        <View style={{ backgroundColor: sItem.active_borrowing_count > 0 ? colors.warning500 + '20' : colors.success500 + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                          <Text style={{ color: sItem.active_borrowing_count > 0 ? colors.warning500 : colors.success500, fontSize: 8, fontWeight: '800' }}>
                                            {sItem.active_borrowing_count} pinjam
                                          </Text>
                                        </View>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                              )}

                              {studentSearchQuery.trim().length >= 2 && !searchLoading && studentSearchResults.length === 0 && (
                                <View style={{ padding: Spacing.md, alignItems: 'center', backgroundColor: colors.surface800, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600 }}>
                                  <Text style={{ fontSize: FontSize.xs, color: colors.textMuted }}>Siswa tidak ditemukan.</Text>
                                </View>
                              )}

                              {studentSearchQuery.trim().length < 2 && (
                                <Text style={{ fontSize: 10, color: colors.textMuted, fontStyle: 'italic', marginLeft: 4 }}>
                                  Ketik minimal 2 karakter untuk mencari...
                                </Text>
                              )}
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.btn, scanMode === 'borrowing' && !studentId.trim() && styles.disabledBtn]}
                disabled={scanMode === 'borrowing' && !studentId.trim()}
                onPress={() => setScanning(true)}
              >
                <Ionicons name="scan" size={20} color={colors.white} />
                <Text style={styles.btnT}>Mulai Scan</Text>
              </TouchableOpacity>

              {/* Offline Queue Manager Accordion */}
              {isAdmin && (
                <View style={styles.queueContainer}>
                  <TouchableOpacity style={styles.queueHeader} onPress={() => setShowQueue(!showQueue)} activeOpacity={0.8}>
                    <View style={styles.queueTitleRow}>
                      <Ionicons name="file-tray-full-outline" size={20} color={colors.text} />
                      <Text style={styles.queueTitle}>Antrean Offline</Text>
                      {getPendingCount() > 0 && (
                        <View style={styles.qBadge}><Text style={styles.qBadgeText}>{getPendingCount()}</Text></View>
                      )}
                    </View>
                    <Ionicons name={showQueue ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>

                  {showQueue && (
                    <View style={styles.queueContent}>
                      <View style={styles.queueActions}>
                        <TouchableOpacity style={[styles.qActionBtn, isSyncingQueue && styles.disabledBtn]} disabled={isSyncingQueue} onPress={triggerManualSync}>
                          {isSyncingQueue ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="sync-outline" size={14} color={colors.white} />}
                          <Text style={styles.qActionText}>Sinkronkan</Text>
                        </TouchableOpacity>
                      </View>

                      {offlineScans.length > 0 ? (
                        <FlatList
                          data={offlineScans}
                          renderItem={renderQueueItem}
                          keyExtractor={(item, idx) => `offline-${item.id || idx}-${idx}`}
                          scrollEnabled={false}
                        />
                      ) : (
                        <View style={styles.qEmpty}>
                          <Ionicons name="folder-open-outline" size={28} color={colors.textMuted} />
                          <Text style={styles.qEmptyText}>Antrean offline kosong.</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Advanced Inventory Audit Panel */}
              {isAdmin && scanMode === 'verification' && (
                <View style={{ gap: Spacing.lg }}>
                  {/* Anomalies Panel */}
                  <View style={styles.queueContainer}>
                    <TouchableOpacity style={styles.queueHeader} onPress={() => setShowAnomalies(!showAnomalies)} activeOpacity={0.8}>
                      <View style={styles.queueTitleRow}>
                        <Ionicons name="alert-circle-outline" size={20} color={colors.accent500} />
                        <Text style={styles.queueTitle}>Anomali Stok Buku</Text>
                        {anomalies.length > 0 && (
                          <View style={[styles.qBadge, { backgroundColor: colors.danger500 }]}><Text style={[styles.qBadgeText, { color: colors.white }]}>{anomalies.length}</Text></View>
                        )}
                      </View>
                      <Ionicons name={showAnomalies ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    {showAnomalies && (
                      <View style={styles.queueContent}>
                        <TouchableOpacity style={[styles.qActionBtn, { backgroundColor: colors.surface700 }]} onPress={fetchAnomalies}>
                          <Ionicons name="sync-outline" size={14} color={colors.white} />
                          <Text style={styles.qActionText}>Segarkan List</Text>
                        </TouchableOpacity>

                        {loadingAnomalies ? (
                          <ActivityIndicator color={colors.primary400} style={{ marginVertical: Spacing.md }} />
                        ) : anomalies.length > 0 ? (
                          anomalies.map((anom: any, idx: number) => (
                            <View key={idx} style={styles.anomalyItem}>
                              <View style={{ flex: 1, paddingRight: Spacing.xs }}>
                                <Text style={styles.anomalyBookTitle} numberOfLines={1}>{anom.book_title}</Text>
                                <Text style={styles.anomalyBookCode}>Kode: {anom.book_code || '-'}</Text>
                                <Text style={styles.anomalyDesc}>
                                  Stok Digital: {anom.total_stock} pcs | QR Terdaftar: {anom.total_qr_count} | Aktif: {anom.active_qr_count}
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
                                <View style={styles.anomalyBadge}>
                                  <Text style={styles.anomalyBadgeText}>Mismatch</Text>
                                </View>
                                <TouchableOpacity
                                  style={{ backgroundColor: colors.danger500, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm }}
                                  onPress={() => handleResolveAnomaly(anom.book_id)}
                                >
                                  <Text style={{ color: colors.white, fontSize: 10, fontWeight: '700' }}>Selesaikan</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))
                        ) : (
                          <View style={styles.qEmpty}>
                            <Ionicons name="checkmark-done-circle-outline" size={28} color={colors.success500} />
                            <Text style={styles.qEmptyText}>Tidak ada anomali persediaan. Sinkron!</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Audit & Re-initialization Action Panel */}
                  <View style={styles.queueContainer}>
                    <TouchableOpacity style={styles.queueHeader} onPress={() => setShowAuditPanel(!showAuditPanel)} activeOpacity={0.8}>
                      <View style={styles.queueTitleRow}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary400} />
                        <Text style={styles.queueTitle}>Fasilitas Audit & Kontrol</Text>
                      </View>
                      <Ionicons name={showAuditPanel ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    {showAuditPanel && (
                      <View style={[styles.queueContent, { gap: Spacing.md }]}>
                        {isHighAdmin && (
                          <View style={{ gap: Spacing.xs, backgroundColor: colors.surface700, padding: Spacing.md, borderRadius: BorderRadius.md }}>
                            <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: colors.text }}>Cari & Pilih Sekolah Kontrol</Text>
                            <View style={styles.inputWrapper}>
                              <Ionicons name="search-outline" size={16} color={colors.surface400} style={styles.inputIcon} />
                              <TextInput
                                style={styles.textInput}
                                placeholder="Ketik nama sekolah (min 2 karakter)..."
                                placeholderTextColor={colors.surface400}
                                value={schoolSearchQuery}
                                onChangeText={setSchoolSearchQuery}
                              />
                            </View>
                            {schoolLoading && <ActivityIndicator size="small" color={colors.primary400} style={{ marginVertical: Spacing.xs }} />}
                            {schoolSearchResults.length > 0 && (
                              <ScrollView style={{ maxHeight: 150, marginTop: Spacing.xs }} keyboardShouldPersistTaps="handled">
                                {schoolSearchResults.map((school: any) => (
                                  <TouchableOpacity
                                    key={school.school_id}
                                    style={{ padding: Spacing.sm, backgroundColor: selectedSchool?.school_id === school.school_id ? colors.primary500 + '30' : colors.surface900, marginBottom: 4, borderRadius: BorderRadius.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                    onPress={() => {
                                      setSelectedSchool(school);
                                      setSchoolSearchQuery(school.school_name);
                                      setSchoolSearchResults([]);
                                    }}
                                  >
                                    <Text style={{ color: colors.text, fontSize: FontSize.xs }}>{school.school_name}</Text>
                                    {selectedSchool?.school_id === school.school_id && <Ionicons name="checkmark" size={14} color={colors.primary400} />}
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            )}
                            {selectedSchool && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs }}>
                                <Ionicons name="school" size={14} color={colors.success500} />
                                <Text style={{ fontSize: 10, color: colors.success500, fontWeight: '600' }}>Sekolah Terpilih: {selectedSchool.school_name}</Text>
                              </View>
                            )}
                          </View>
                        )}
                        <Text style={styles.controlPanelDesc}>
                          Gunakan tombol di bawah ini untuk mensinkronkan ulang data total persediaan fisik vs digital di sekolah ini.
                        </Text>
                        <View style={{ gap: Spacing.sm }}>
                          <TouchableOpacity
                            style={[styles.auditActionBtn, isHighAdmin && !selectedSchool && styles.disabledBtn]}
                            disabled={isHighAdmin && !selectedSchool}
                            onPress={handleRunAudit}
                          >
                            <Ionicons name="analytics" size={18} color={colors.white} />
                            <Text style={styles.auditActionText}>Jalankan Audit & Rekonsiliasi</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.auditActionBtn, { backgroundColor: colors.danger500 }, isHighAdmin && !selectedSchool && styles.disabledBtn]}
                            disabled={isHighAdmin && !selectedSchool}
                            onPress={handleInitializeStock}
                          >
                            <Ionicons name="refresh-circle-outline" size={18} color={colors.white} />
                            <Text style={styles.auditActionText}>Inisialisasi Ulang Stok (Reset)</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: colors.surface900 },
    container: { flex: 1, backgroundColor: colors.surface900 },
    mainContainer: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, minHeight: 400 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modeBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: colors.primary500, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, position: 'absolute', top: 50 },
    modeBannerText: { color: colors.white, fontSize: FontSize.sm, fontWeight: '700' },
    frame: { width: 260, height: 260, borderWidth: 3, borderColor: colors.primary400, borderRadius: BorderRadius.xl },
    scanT: { color: colors.white, fontSize: FontSize.md, fontWeight: '600', marginTop: Spacing.xl },
    cancel: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: colors.danger500, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full },
    cancelT: { color: colors.white, fontWeight: '700' },
    hero: { alignItems: 'center', textAlign: 'center', marginTop: Spacing.md },
    icon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary500 + '15', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: colors.text },
    desc: { fontSize: FontSize.sm, color: colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
    adminPanel: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.md },
    panelTitle: { fontSize: FontSize.md, fontWeight: '800', color: colors.text },
    modeGrid: { flexDirection: 'row', gap: Spacing.sm },
    modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: colors.surface900, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600 },
    activeMode: { backgroundColor: colors.primary500, borderColor: colors.primary400 },
    modeBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: colors.textMuted },
    activeModeText: { color: colors.white },
    inputContainer: { gap: 6, marginTop: Spacing.xs },
    inputLabel: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface900, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600, paddingHorizontal: Spacing.md },
    inputIcon: { marginRight: Spacing.sm },
    textInput: { flex: 1, height: 44, color: colors.text, fontSize: FontSize.md },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.primary500, borderRadius: BorderRadius.lg, paddingVertical: Spacing.lg, width: '100%' },
    disabledBtn: { opacity: 0.5 },
    btnT: { fontSize: FontSize.lg, fontWeight: '700', color: colors.white },
    perm: { fontSize: FontSize.md, color: colors.textMuted, marginVertical: Spacing.xl, textAlign: 'center', lineHeight: 22 },
    res: { padding: Spacing.lg, gap: Spacing.lg },
    ok: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: Spacing.sm, backgroundColor: colors.success500 + '15', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    okT: { fontSize: FontSize.md, fontWeight: '700', color: colors.success500 },
    card: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: colors.surface600 },
    lbl: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted, marginBottom: 6, letterSpacing: 1 },
    val: { fontSize: FontSize.xl, fontWeight: '800', color: colors.text },
    sub: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: 4 },
    netStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, alignSelf: 'center', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full },
    netStatusText: { fontSize: FontSize.xs, fontWeight: '700' },

    // Offline Queue UI
    queueContainer: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.surface600, overflow: 'hidden' },
    queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
    queueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    queueTitle: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
    qBadge: { backgroundColor: colors.warning500, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
    qBadgeText: { fontSize: FontSize.xs, fontWeight: '800', color: colors.surface900 },
    queueContent: { borderTopWidth: 1, borderTopColor: colors.surface600, padding: Spacing.md, gap: Spacing.md },
    queueActions: { flexDirection: 'row', gap: Spacing.sm },
    qActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: colors.primary500, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
    qActionText: { color: colors.white, fontSize: FontSize.xs, fontWeight: '700' },
    qEmpty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
    qEmptyText: { fontSize: FontSize.xs, color: colors.textMuted },
    qItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    qLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    qTitle: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    qPayload: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2, width: '90%' },
    qError: { fontSize: FontSize.xs, color: colors.danger500, marginTop: 2, fontWeight: '600' },
    qTime: { fontSize: FontSize.xs, color: colors.textMuted },

    // Traceability & Adjustments UI
    loadingCard: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: colors.surface600, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.md },
    loadingCardText: { color: colors.textMuted, fontSize: FontSize.sm },
    traceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    traceLabel: { color: colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
    traceVal: { color: colors.text, fontSize: FontSize.sm, fontWeight: '700' },
    sectionSubtitle: { color: colors.text, fontSize: FontSize.sm, fontWeight: '800', marginTop: Spacing.sm, marginBottom: 4 },
    adjustmentGrid: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    adjustBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
    adjustBtnText: { color: colors.white, fontSize: FontSize.xs, fontWeight: '700' },
    badge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
    badgeSuccess: { backgroundColor: colors.success500 + '20' },
    badgeWarning: { backgroundColor: colors.warning500 + '20' },
    badgeDanger: { backgroundColor: colors.danger500 + '20' },
    badgeSecondary: { backgroundColor: colors.surface500 },
    badgeText: { fontSize: FontSize.xs, fontWeight: '800' },
    logItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    logTitle: { color: colors.text, fontSize: FontSize.sm, fontWeight: '700' },
    logSub: { color: colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
    logTypeBadge: { fontSize: FontSize.xs, color: colors.primary400, fontWeight: '700', backgroundColor: colors.primary500 + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },

    // Anomalies list UI
    anomalyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    anomalyBookTitle: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    anomalyBookCode: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    anomalyDesc: { fontSize: FontSize.xs, color: colors.accent500, marginTop: 4 },
    anomalyBadge: { backgroundColor: colors.danger500 + '20', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
    anomalyBadgeText: { fontSize: FontSize.xs, color: colors.danger500, fontWeight: '800' },

    // Control panel UI
    controlPanelDesc: { fontSize: FontSize.xs, color: colors.textMuted, lineHeight: 18 },
    auditActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.primary500, borderRadius: BorderRadius.md, paddingVertical: Spacing.lg, width: '100%' },
    auditActionText: { color: colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  });
