import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "../../api/client";
import type { UserProfile } from "../../types/profile";

type ProfileFormState = {
  user_id: string;
  home: {
    lat: string;
    lon: string;
    label: string;
    district: string;
  };
  work: {
    lat: string;
    lon: string;
    label: string;
  };
};

type ValidationResult = {
  errors: string[];
  fieldErrors: Record<string, string>;
  parsed: {
    user_id: string;
    home: { lat: number; lon: number; label?: string; district?: string };
    work?: { lat: number; lon: number; label?: string };
  } | null;
};

const emptyForm: ProfileFormState = {
  user_id: "",
  home: {
    lat: "",
    lon: "",
    label: "",
    district: "",
  },
  work: {
    lat: "",
    lon: "",
    label: "",
  },
};

const toFormState = (profile: UserProfile): ProfileFormState => ({
  user_id: profile.user_id ?? "",
  home: {
    lat: profile.home?.lat !== undefined ? String(profile.home.lat) : "",
    lon: profile.home?.lon !== undefined ? String(profile.home.lon) : "",
    label: profile.home?.label ?? "",
    district: profile.home?.district ?? "",
  },
  work: {
    lat:
      profile.work && profile.work.lat !== undefined
        ? String(profile.work.lat)
        : "",
    lon:
      profile.work && profile.work.lon !== undefined
        ? String(profile.work.lon)
        : "",
    label: profile.work?.label ?? "",
  },
});

const formatIssues = (issues: unknown): string => {
  if (Array.isArray(issues)) {
    return issues
      .map((issue) => {
        if (typeof issue === "string") return issue;
        if (issue && typeof issue === "object" && "message" in issue) {
          return String((issue as Record<string, unknown>).message);
        }
        return JSON.stringify(issue);
      })
      .join("\n");
  }
  if (issues && typeof issues === "object") {
    return JSON.stringify(issues);
  }
  return String(issues ?? "Validation failed");
};

const parseOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const ProfilePage = () => {
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetFeedback = () => {
    setErrors([]);
    setFieldErrors({});
    setNotice(null);
    setSuccess(null);
  };

  const handleInputChange = useCallback(
    (section: "user" | "home" | "work", field: string, value: string) => {
      setForm((prev) => {
        if (section === "user") {
          return { ...prev, user_id: value };
        }
        if (section === "home") {
          return { ...prev, home: { ...prev.home, [field]: value } };
        }
        return { ...prev, work: { ...prev.work, [field]: value } };
      });
    },
  []);

  const validate = (): ValidationResult => {
    const nextErrors: string[] = [];
    const nextFieldErrors: Record<string, string> = {};
    const trimmedUserId = form.user_id.trim();

    if (!trimmedUserId) {
      const message = "User ID is required.";
      nextErrors.push(message);
      nextFieldErrors["user_id"] = message;
    }

    const parseRequiredNumber = (
      value: string,
      key: string,
      label: string,
    ): number | null => {
      const trimmed = value.trim();
      if (!trimmed) {
        const message = `${label} is required.`;
        nextErrors.push(message);
        nextFieldErrors[key] = message;
        return null;
      }
      const num = Number(trimmed);
      if (!Number.isFinite(num)) {
        const message = `${label} must be a valid number.`;
        nextErrors.push(message);
        nextFieldErrors[key] = message;
        return null;
      }
      return num;
    };

    const homeLat = parseRequiredNumber(
      form.home.lat,
      "home.lat",
      "Home latitude",
    );
    const homeLon = parseRequiredNumber(
      form.home.lon,
      "home.lon",
      "Home longitude",
    );

    const workEntered = [form.work.lat, form.work.lon, form.work.label].some(
      (value) => value.trim().length > 0,
    );

    let workLat: number | null = null;
    let workLon: number | null = null;

    if (workEntered) {
      workLat = parseRequiredNumber(
        form.work.lat,
        "work.lat",
        "Work latitude",
      );
      workLon = parseRequiredNumber(
        form.work.lon,
        "work.lon",
        "Work longitude",
      );
    }

    const isValid =
      nextErrors.length === 0 &&
      homeLat !== null &&
      homeLon !== null &&
      (!workEntered || (workLat !== null && workLon !== null));

    if (!isValid) {
      return { errors: nextErrors, fieldErrors: nextFieldErrors, parsed: null };
    }

    const payload: UserProfile = {
      user_id: trimmedUserId,
      home: {
        lat: homeLat as number,
        lon: homeLon as number,
      },
    };

    const homeLabel = parseOptional(form.home.label);
    const homeDistrict = parseOptional(form.home.district);

    if (homeLabel !== undefined) payload.home.label = homeLabel;
    if (homeDistrict !== undefined) payload.home.district = homeDistrict;

    if (workEntered && workLat !== null && workLon !== null) {
      const workLabel = parseOptional(form.work.label);
      payload.work = {
        lat: workLat,
        lon: workLon,
      };
      if (workLabel !== undefined) payload.work.label = workLabel;
    }

    return {
      errors: [],
      fieldErrors: {},
      parsed: payload,
    };
  };

  const handleLoad = async () => {
    resetFeedback();
    const trimmedUserId = form.user_id.trim();
    if (!trimmedUserId) {
      setErrors(["User ID is required to load a profile."]);
      setFieldErrors({ user_id: "User ID is required." });
      return;
    }
    setLoading(true);
    try {
      const profile = await api.getProfile<UserProfile>(trimmedUserId);
      setForm(toFormState(profile));
      setSuccess("Profile loaded.");
    } catch (err) {
      const error = err as ApiError;
      if (error?.status === 404) {
        setNotice("No profile found — create one and Save.");
      } else {
        const message =
          (error && "message" in error && typeof error.message === "string")
            ? error.message
            : "Network error — try again.";
        setErrors([message]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    resetFeedback();
    const { errors: validationErrors, fieldErrors: validationFieldErrors, parsed } =
      validate();

    if (!parsed) {
      setErrors(validationErrors);
      setFieldErrors(validationFieldErrors);
      return;
    }

    setSaving(true);
    try {
      const saved = await api.saveProfile<UserProfile>(parsed);
      setForm(toFormState(saved));
      setSuccess("Profile saved.");
      toast.success("Profile saved.");
    } catch (err) {
      const error = err as ApiError;
      if (error?.status === 400 && error?.issues) {
        const message = formatIssues(error.issues);
        setErrors([`Validation failed: ${message}`]);
      } else {
        const message =
          (error && "message" in error && typeof error.message === "string")
            ? error.message
            : "Network error — try again.";
        setErrors([message]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestBriefing = async () => {
    resetFeedback();
    const trimmedUserId = form.user_id.trim();
    if (!trimmedUserId) {
      setErrors(["User ID is required to test briefing."]);
      setFieldErrors({ user_id: "User ID is required." });
      return;
    }
    setLoading(true);
    try {
      const result = await api.getBriefing<Record<string, unknown>>(trimmedUserId);
      console.log("Briefing:", result);
      setSuccess("Briefing fetched. Check console for details.");
      toast.success("Briefing fetched. Check console for details.");
    } catch (err) {
      const error = err as ApiError;
      const message =
        (error && "message" in error && typeof error.message === "string")
          ? error.message
          : "Network error — try again.";
      setErrors([message]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(emptyForm);
    resetFeedback();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">User Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile so we can personalize your travel briefing.
        </p>
      </header>

      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {notice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {notice}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Account</h2>
        <div className="grid gap-2">
          <label className="font-medium" htmlFor="user_id">
            User ID
          </label>
          <input
            id="user_id"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm"
            value={form.user_id}
            onChange={(event) =>
              handleInputChange("user", "user_id", event.target.value)
            }
            aria-invalid={Boolean(fieldErrors["user_id"])}
            aria-describedby={fieldErrors["user_id"] ? "user_id_error" : undefined}
          />
          {fieldErrors["user_id"] && (
            <p id="user_id_error" className="text-sm text-red-600">
              {fieldErrors["user_id"]}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleLoad}
            className="rounded-md bg-primary px-4 py-2 text-white disabled:opacity-50"
            disabled={loading || saving || !form.user_id.trim()}
          >
            {loading ? "Loading..." : "Load"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-white disabled:opacity-50"
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleTestBriefing}
            className="rounded-md border border-input px-4 py-2 disabled:opacity-50"
            disabled={loading || saving || !form.user_id.trim()}
          >
            Test Briefing
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-input px-4 py-2"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Home</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="font-medium" htmlFor="home_lat">
              Latitude
            </label>
            <input
              id="home_lat"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm"
              value={form.home.lat}
              onChange={(event) =>
                handleInputChange("home", "lat", event.target.value)
              }
              aria-invalid={Boolean(fieldErrors["home.lat"])}
              aria-describedby={fieldErrors["home.lat"] ? "home_lat_error" : undefined}
              inputMode="decimal"
            />
            {fieldErrors["home.lat"] && (
              <p id="home_lat_error" className="text-sm text-red-600">
                {fieldErrors["home.lat"]}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="font-medium" htmlFor="home_lon">
              Longitude
            </label>
            <input
              id="home_lon"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm"
              value={form.home.lon}
              onChange={(event) =>
                handleInputChange("home", "lon", event.target.value)
              }
              aria-invalid={Boolean(fieldErrors["home.lon"])}
              aria-describedby={fieldErrors["home.lon"] ? "home_lon_error" : undefined}
              inputMode="decimal"
            />
            {fieldErrors["home.lon"] && (
              <p id="home_lon_error" className="text-sm text-red-600">
                {fieldErrors["home.lon"]}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="font-medium" htmlFor="home_label">
              Label
            </label>
            <input
              id="home_label"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm"
              value={form.home.label}
              onChange={(event) =>
                handleInputChange("home", "label", event.target.value)
              }
            />
          </div>
          <div className="space-y-1">
            <label className="font-medium" htmlFor="home_district">
              District (optional)
            </label>
            <input
              id="home_district"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm"
              value={form.home.district}
              onChange={(event) =>
                handleInputChange("home", "district", event.target.value)
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Work (optional)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="font-medium" htmlFor="work_lat">
              Latitude
            </label>
            <input
              id="work_lat"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm"
              value={form.work.lat}
              onChange={(event) =>
                handleInputChange("work", "lat", event.target.value)
              }
              aria-invalid={Boolean(fieldErrors["work.lat"])}
              aria-describedby={fieldErrors["work.lat"] ? "work_lat_error" : undefined}
              inputMode="decimal"
            />
            {fieldErrors["work.lat"] && (
              <p id="work_lat_error" className="text-sm text-red-600">
                {fieldErrors["work.lat"]}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="font-medium" htmlFor="work_lon">
              Longitude
            </label>
            <input
              id="work_lon"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm"
              value={form.work.lon}
              onChange={(event) =>
                handleInputChange("work", "lon", event.target.value)
              }
              aria-invalid={Boolean(fieldErrors["work.lon"])}
              aria-describedby={fieldErrors["work.lon"] ? "work_lon_error" : undefined}
              inputMode="decimal"
            />
            {fieldErrors["work.lon"] && (
              <p id="work_lon_error" className="text-sm text-red-600">
                {fieldErrors["work.lon"]}
              </p>
            )}
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="font-medium" htmlFor="work_label">
              Label
            </label>
            <input
              id="work_label"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm"
              value={form.work.label}
              onChange={(event) =>
                handleInputChange("work", "label", event.target.value)
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProfilePage;
