import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '../../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft } from 'lucide-react';

interface UserLocationSetting {
  name: string;
  lat?: number;
  lon?: number;
  lastGeocodedAt?: string;
}

interface UserSettingsResponse {
  defaultOrigin?: UserLocationSetting;
  defaultDestination?: UserLocationSetting;
  coordinateLock?: boolean;
}

interface SettingsPayload {
  defaultOrigin?: { name: string };
  defaultDestination?: { name: string };
  coordinateLock?: boolean;
}

interface CoordinatePreviewProps {
  title: string;
  data?: UserLocationSetting;
}

const initialForm = {
  origin: '',
  destination: '',
  coordinateLock: false,
};

function formatCoordinate(value?: number): string {
  if (typeof value !== 'number') return '—';
  return value.toFixed(6);
}

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function CoordinatePreview({ title, data }: CoordinatePreviewProps) {
  return (
    <div className="rounded-lg border bg-card/40 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {data ? (
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <p className="text-foreground">{data.name}</p>
          <p>위도: {formatCoordinate(data.lat)}</p>
          <p>경도: {formatCoordinate(data.lon)}</p>
          <p className="text-xs">지오코딩: {formatTimestamp(data.lastGeocodedAt)}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">아직 저장된 좌표가 없습니다.</p>
      )}
    </div>
  );
}

const ProfilePage = () => {
  const [form, setForm] = useState(initialForm);
  const [resolvedOrigin, setResolvedOrigin] = useState<UserLocationSetting | undefined>(undefined);
  const [resolvedDestination, setResolvedDestination] = useState<UserLocationSetting | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await api.getSettings<UserSettingsResponse>();
      setForm({
        origin: settings?.defaultOrigin?.name ?? '',
        destination: settings?.defaultDestination?.name ?? '',
        coordinateLock: settings?.coordinateLock ?? false,
      });
      setResolvedOrigin(settings?.defaultOrigin);
      setResolvedDestination(settings?.defaultDestination);
    } catch (error) {
      const message = error instanceof Error ? error.message : '설정을 불러오지 못했습니다.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const payload: SettingsPayload = { coordinateLock: form.coordinateLock };
    const originName = form.origin.trim();
    const destinationName = form.destination.trim();

    if (originName) {
      payload.defaultOrigin = { name: originName };
    }
    if (destinationName) {
      payload.defaultDestination = { name: destinationName };
    }

    if (
      !payload.defaultOrigin &&
      !payload.defaultDestination &&
      !resolvedOrigin &&
      !resolvedDestination &&
      form.coordinateLock
    ) {
      toast.error('좌표 고정을 사용하려면 먼저 출발지 또는 도착지를 저장하세요.');
      return;
    }

    try {
      setSaving(true);
      const saved = await api.saveSettings<UserSettingsResponse>(payload);
      setResolvedOrigin(saved.defaultOrigin);
      setResolvedDestination(saved.defaultDestination);
      setForm((prev) => ({
        origin: saved.defaultOrigin?.name ?? prev.origin,
        destination: saved.defaultDestination?.name ?? prev.destination,
        coordinateLock: saved.coordinateLock ?? prev.coordinateLock,
      }));
      toast.success('설정이 저장되었습니다.');
    } catch (error) {
      const err = error as ApiError;
      if (err?.message) {
        toast.error(err.message);
      } else {
        toast.error('설정을 저장할 수 없습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-10">
      <div className="container mx-auto max-w-3xl space-y-6 px-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">기본 위치 설정</h1>
            <p className="text-sm text-muted-foreground">
              장소 이름만 입력하면 저장 시 좌표가 자동으로 계산됩니다. 필요할 때 좌표를 고정하여 재사용할 수 있어요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/" className="flex items-center gap-1">
                <ChevronLeft className="h-4 w-4" />
                뒤로 가기
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void loadSettings()} disabled={loading || saving}>
              {loading ? '불러오는 중…' : '새로고침'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>위치 저장</CardTitle>
            <CardDescription>출발지와 도착지를 장소 이름으로 입력하면 저장 시 좌표가 확인됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="origin-name">기본 출발지</Label>
                  <Input
                    id="origin-name"
                    placeholder="예: Gangnam Station"
                    value={form.origin}
                    onChange={(event) => setForm((prev) => ({ ...prev, origin: event.target.value }))}
                    disabled={loading || saving}
                  />
                  <p className="text-xs text-muted-foreground">지오코딩에 성공하면 좌표가 저장됩니다.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination-name">기본 도착지</Label>
                  <Input
                    id="destination-name"
                    placeholder="예: Seoul Station"
                    value={form.destination}
                    onChange={(event) => setForm((prev) => ({ ...prev, destination: event.target.value }))}
                    disabled={loading || saving}
                  />
                  <p className="text-xs text-muted-foreground">필요 시 하나의 위치만 저장해도 됩니다.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card/60 p-4">
                <div>
                  <Label htmlFor="coordinate-lock" className="text-sm font-medium text-foreground">
                    좌표 고정 (Coordinate Lock)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    활성화하면 저장된 좌표만 사용하고, 폼에 입력한 값을 무시합니다.
                  </p>
                </div>
                <Switch
                  id="coordinate-lock"
                  checked={form.coordinateLock}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, coordinateLock: checked }))}
                  disabled={loading || saving}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? '저장 중…' : '설정 저장'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>저장된 좌표 미리보기</CardTitle>
            <CardDescription>백엔드에 저장된 최신 좌표를 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <CoordinatePreview title="출발지" data={resolvedOrigin} />
              <CoordinatePreview title="도착지" data={resolvedDestination} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
