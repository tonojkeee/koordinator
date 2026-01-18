import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { AxiosError } from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { LogIn, AlertCircle, Settings } from 'lucide-react';
import { useConfigStore } from '../../store/useConfigStore';
import { useTranslation } from 'react-i18next';


const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { t } = useTranslation();
    const setAuth = useAuthStore((state) => state.setAuth);
    const navigate = useNavigate();
    const setShowSetup = useConfigStore((state) => state.setShowSetup);


    const [registrationAllowed, setRegistrationAllowed] = useState(true);

    useEffect(() => {
        api.get('/auth/config').then(res => {
            if (res.data.allow_registration === false) {
                setRegistrationAllowed(false);
            }
        }).catch(() => { });
    }, []);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);

            const loginRes = await api.post('/auth/login', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const { access_token, refresh_token } = loginRes.data;

            const userRes = await api.get('/auth/me', {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            });

            setAuth(userRes.data, access_token, refresh_token);
            navigate('/');
        } catch (err: unknown) {
            const error = err as AxiosError<{ detail: string }>;
            setError(error.response?.data?.detail || t('auth.loginFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
            {/* Connection Settings Trigger */}
            <button
                onClick={() => setShowSetup(true)}
                className="absolute top-8 right-8 p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all z-20"
                title="Настроить подключение"
            >
                <Settings size={24} />
            </button>

            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/30 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-600/20 rounded-full blur-[120px] animate-pulse" />

            <div className="max-w-md w-full p-8 relative z-10 animate-in">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[2.5rem] shadow-2xl">
                    <div className="text-center mb-10">
                        <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl mb-6 p-4">
                            <img src="/icon.png" alt="GIS Coordinator" className="w-full h-full object-contain" />
                        </div>
                        <h2 className="text-4xl font-bold text-white tracking-tight">
                            {t('auth.signInTitle')}
                        </h2>
                        <p className="mt-4 text-slate-400 font-medium">
                            {registrationAllowed && (
                                <>
                                    {t('auth.noAccount')}{' '}
                                    <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition-colors underline decoration-2 underline-offset-4">
                                        {t('auth.registerLink')}
                                    </Link>
                                </>
                            )}
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-start space-x-3 text-rose-400 animate-in">
                                <AlertCircle className="shrink-0" size={20} />
                                <p className="text-sm font-semibold">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">
                                    {t('common.username')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full h-14 px-6 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder={t('auth.enterUsername')}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">
                                    {t('common.password')}
                                </label>
                                <input
                                    type="password"
                                    required
                                    className="w-full h-14 px-6 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 flex items-center justify-center bg-indigo-600 text-white text-lg font-bold rounded-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/30 disabled:opacity-50 mt-8"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                <span className="flex items-center space-x-2">
                                    <span>{t('auth.signInButton')}</span>
                                    <LogIn size={20} />
                                </span>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Internal Loader
const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

export default LoginPage;
