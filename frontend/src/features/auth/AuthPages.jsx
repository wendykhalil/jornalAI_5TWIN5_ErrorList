import { useState } from "react"
import { Link, useNavigate } from "react-router"
import authService from "../../services/authService"
import { useStore } from "../../store/AppStore"
import {
  Brain,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button, Input } from "../../components/ui"
function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/login" className="mb-10 inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-600 text-white">
              <Brain />
            </span>
            <span className="text-xl font-extrabold">
              MindLog <b className="text-violet-600">AI</b>
            </span>
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <Sparkles size={14} /> Votre espace personnel intelligent
          </span>
        </div>
        <div className="relative max-w-xl">
          <blockquote className="text-4xl font-semibold leading-tight">
            « Vos journées deviennent des souvenirs. MindLog vous aide à en
            prendre soin. »
          </blockquote>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              "Privé par conception",
              "Pensé pour vous",
              "Toujours accessible",
            ].map((x) => (
              <div
                key={x}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold"
              >
                <ShieldCheck className="mb-3 text-cyan-300" />
                {x}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-sm text-slate-400">
          Votre vie, vos souvenirs, votre histoire.
        </p>
      </div>
    </div>
  )
}
export function Login() {
  const [form, setForm] = useState({
      username: "",
      password: "",
    }),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const { login } = useStore()
  const submit = async (e) => {
    e.preventDefault()
    setError("")
    if (!form.username.trim() || !form.password) {
      setError("Saisissez votre nom d’utilisateur et votre mot de passe.")
      return
    }
    setLoading(true)
    try {
      await login(form.username.trim(), form.password)
      // AppStore.login() updates user and isAuthenticated state
      // Navigation to /dashboard will trigger GuestRoute which redirects
      // authenticated users based on their role (user → /dashboard, admin → /admin/dashboard)
      nav("/dashboard", { replace: true })
    } catch (err) {
      setError(err.message || "Connexion impossible.")
    } finally {
      setLoading(false)
    }
  }
  return (
    <AuthLayout
      title="Bon retour parmi nous"
      subtitle="Connectez-vous pour retrouver votre journal personnel."
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Nom d’utilisateur"
          type="text"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <div className="relative">
          <Input
            label="Mot de passe"
            type={show ? "text" : "password"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-10 text-slate-400"
            aria-label="Afficher le mot de passe"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked
              className="accent-violet-600"
            />{" "}
            Se souvenir de moi
          </label>
          <Link className="font-bold text-violet-600" to="/forgot-password">
            Mot de passe oublié ?
          </Link>
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button className="w-full" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
          <ArrowRight size={17} />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Pas encore de compte ?{" "}
        <Link className="font-bold text-violet-600" to="/register">
          Créer un compte
        </Link>
      </p>
    </AuthLayout>
  )
}
export function Register() {
  const [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      first: "",
      last: "",
      username: "",
      email: "",
      password: "",
      confirm: "",
      terms: false,
    })
  const nav = useNavigate()
  const set = (k, v) => setForm({ ...form, [k]: v })
  const [loading, setLoading] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setError("")
    if (!form.first.trim() || !form.last.trim() || !form.username.trim() ||
        !form.email.trim() || form.password.length < 8 ||
        form.password !== form.confirm || !form.terms) {
      setError("Complétez les champs, confirmez le mot de passe et acceptez les conditions.")
      return
    }
    setLoading(true)
    try {
      await authService.register({
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first.trim(),
        last_name: form.last.trim(),
        password: form.password,
        password_confirm: form.confirm,
      })
      // Registration creates the account; the user logs in separately.
      nav("/login", { replace: true })
    } catch (err) {
      setError(err.message || "Inscription impossible.")
    } finally {
      setLoading(false)
    }
  }
  return (
    <AuthLayout
      title="Créez votre espace"
      subtitle="Commencez à conserver ce qui compte, à votre rythme."
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Input
          label="Prénom"
          value={form.first}
          onChange={(e) => set("first", e.target.value)}
        />
        <Input
          label="Nom"
          value={form.last}
          onChange={(e) => set("last", e.target.value)}
        />
        <Input
          className="col-span-2"
          label="Nom d’utilisateur"
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
        />
        <Input
          className="col-span-2"
          label="Adresse email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <Input
          label="Mot de passe"
          type={show ? "text" : "password"}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
        <Input
          label="Confirmation"
          type={show ? "text" : "password"}
          value={form.confirm}
          onChange={(e) => set("confirm", e.target.value)}
        />
        <button
          type="button"
          className="col-span-2 text-left text-xs font-bold text-violet-600"
          onClick={() => setShow(!show)}
        >
          {show ? "Masquer" : "Afficher"} les mots de passe
        </button>
        <div className="col-span-2 h-1.5 rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${
              form.password.length > 10
                ? "w-full bg-emerald-500"
                : form.password.length > 5
                  ? "w-2/3 bg-amber-400"
                  : "w-1/3 bg-red-400"
            }`}
          />
        </div>
        <label className="col-span-2 flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(e) => set("terms", e.target.checked)}
            className="mt-1 accent-violet-600"
          />{" "}
          J’accepte les conditions d’utilisation.
        </label>
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        <Button className="col-span-2" disabled={loading}>{loading ? "Création..." : "Créer mon compte"}</Button>
      </form>
      <p className="mt-5 text-center text-sm">
        Déjà membre ?{" "}
        <Link to="/login" className="font-bold text-violet-600">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  )
}
export function Forgot({ reset = false }) {
  const [done, setDone] = useState(false),
    [value, setValue] = useState("")
  return (
    <AuthLayout
      title={
        reset
          ? "Choisir un nouveau mot de passe"
          : "Réinitialiser le mot de passe"
      }
      subtitle="Cette action est simulée dans la version de démonstration."
    >
      {done ? (
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <Check className="mx-auto text-emerald-600" />
          <h2 className="mt-3 font-extrabold">Demande enregistrée</h2>
          <p className="mt-2 text-sm text-slate-600">
            {reset
              ? "Votre mot de passe démo a été modifié."
              : "Un lien fictif a été envoyé à votre adresse."}
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block font-bold text-violet-600"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (value.length > 5) setDone(true)
          }}
          className="space-y-4"
        >
          <Input
            label={reset ? "Nouveau mot de passe" : "Adresse email"}
            type={reset ? "password" : "email"}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {reset && (
            <Input label="Confirmer le mot de passe" type="password" required />
          )}
          <Button className="w-full">
            {reset ? "Mettre à jour" : "Envoyer le lien"}
          </Button>
          <Link
            to="/login"
            className="block text-center text-sm font-bold text-violet-600"
          >
            Retour à la connexion
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
export function Onboarding() {
  const [step, setStep] = useState(0),
    [selected, setSelected] = useState(["Souvenirs", "Études"])
  const nav = useNavigate()
  const steps = [
    [
      "Bienvenue dans MindLog AI",
      "Nous allons personnaliser votre espace en quelques étapes.",
    ],
    [
      "Vos préférences",
      "Choisissez la langue et l’apparence qui vous conviennent.",
    ],
    [
      "Ce qui compte pour vous",
      "Sélectionnez les thèmes que vous souhaitez suivre.",
    ],
    [
      "Votre espace est prêt",
      "Commencez à raconter votre histoire dès aujourd’hui.",
    ],
  ]
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10">
        <div className="mb-10 flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-violet-600" : "bg-slate-100"
              }`}
            />
          ))}
        </div>
        <div className="mb-7 grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">
          <Brain />
        </div>
        <h1 className="text-3xl font-extrabold">{steps[step][0]}</h1>
        <p className="mt-2 text-slate-500">{steps[step][1]}</p>
        <div className="my-8 min-h-40">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Prénom" defaultValue="Aya" />
              <Input label="Nom" defaultValue="Mansour" />
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="rounded-2xl border-2 border-violet-500 bg-violet-50 p-5 font-bold">
                Français{" "}
                <span className="block text-sm font-normal text-slate-500">
                  Langue de l’interface
                </span>
              </label>
              <label className="rounded-2xl border border-slate-200 p-5 font-bold">
                Mode clair{" "}
                <span className="block text-sm font-normal text-slate-500">
                  Vous pourrez changer plus tard
                </span>
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-wrap gap-3">
              {[
                "Souvenirs",
                "Émotions",
                "Habitudes",
                "Études",
                "Voyages",
                "Famille",
              ].map((x) => (
                <button
                  key={x}
                  onClick={() =>
                    setSelected(
                      selected.includes(x)
                        ? selected.filter((y) => y !== x)
                        : [...selected, x],
                    )
                  }
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    selected.includes(x)
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200"
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="rounded-2xl bg-emerald-50 p-6 text-emerald-800">
              <Check className="mb-3" />
              Vos préférences ont été enregistrées localement pour cette
              démonstration.
            </div>
          )}
        </div>
        <div className="flex justify-between">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Retour
          </Button>
          <div className="flex gap-2">
            {step < 3 && (
              <Button variant="secondary" onClick={() => setStep(3)}>
                Passer
              </Button>
            )}
            <Button
              onClick={() =>
                step === 3 ? nav("/dashboard") : setStep(step + 1)
              }
            >
              {step === 3 ? "Ouvrir mon tableau de bord" : "Continuer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
export function AdminLogin() {
  const { user: storeUser } = useStore()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await login(username.trim(), password)

      // AppStore.login() has completed and updated user state.
      // Verify the logged-in user is an admin.
      if (storeUser?.role !== "admin") {
        // Not an admin. Log out and show error.
        await logout()
        setError("Accès réservé aux administrateurs.")
        return
      }

      navigate("/admin/dashboard", { replace: true })
    } catch (err) {
      setError(err.message || "Erreur de connexion.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Connexion administrateur"
      subtitle="Accédez à votre espace d'administration MindLog AI."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Nom d'utilisateur ou email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <Input
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button className="w-full" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </Button>

        <Link
          to="/login"
          className="block text-center text-sm font-semibold text-violet-600"
        >
          Retour à la connexion utilisateur
        </Link>
      </form>
    </AuthLayout>
  )
}
