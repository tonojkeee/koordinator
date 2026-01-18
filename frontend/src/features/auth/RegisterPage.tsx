import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { AxiosError } from 'axios';
import { AlertCircle, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';


const RegisterPage: React.FC = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        username: '',
        full_name: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const [checkingConfig, setCheckingConfig] = useState(true);
    const [registrationAllowed, setRegistrationAllowed] = useState(true);

    useEffect(() => {
        api.get('/auth/config').then(res => {
            if (res.data.allow_registration === false) {
                setRegistrationAllowed(false);
            }
        }).finally(() => setCheckingConfig(false));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError(t('auth.passwordsDoNotMatch') || 'Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            await api.post('/auth/register', {
                username: formData.username,
                full_name: formData.full_name || null,
                password: formData.password,
            });

            navigate('/login', { state: { message: t('auth.registrationSuccessful') || 'Registration successful! Please login.' } });
        } catch (err: unknown) {
            const error = err as AxiosError<{ detail: string }>;
            setError(error.response?.data?.detail || t('auth.registrationFailed') || 'Something went wrong during registration.');
        } finally {
            setLoading(false);
        }
    };

    if (checkingConfig) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        );
    }

    if (!registrationAllowed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
                <div className="max-w-md text-center space-y-4">
                    <AlertCircle size={48} className="mx-auto text-rose-500" />
                    <h2 className="text-2xl font-bold">{t('auth.registrationDisabled')}</h2>
                    <p className="text-slate-400">
                        {t('auth.contactAdminForAccount', 'Please contact an administrator to create an account.')}
                    </p>
                    <Link to="/login" className="inline-block mt-4 px-6 py-2 bg-indigo-600 rounded-xl font-bold">
                        {t('auth.backToLogin')}
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900 py-12 px-4">
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/30 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-rose-600/20 rounded-full blur-[120px] animate-pulse" />

            <div className="max-w-xl w-full p-4 relative z-10 animate-in">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl mb-6 p-4">
                            <img src="/icon.png" alt="GIS Coordinator" className="w-full h-full object-contain" />
                        </div>
                        <h2 className="text-4xl font-bold text-white tracking-tight">
                            {t('auth.registerTitle')}
                        </h2>
                        <p className="mt-4 text-slate-400 font-medium max-w-sm mx-auto">
                            {t('auth.registerPrompt')}
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-start space-x-3 text-rose-400 animate-in">
                                <AlertCircle className="shrink-0" size={20} />
                                <p className="text-sm font-semibold">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-4">
                                <FormGroup label={t('common.username')} name="username" value={formData.username} onChange={handleChange} placeholder="johndoe" required />
                                <FormGroup label={t('common.fullNameOptional')} name="full_name" value={formData.full_name} onChange={handleChange} placeholder="John Doe" />
                                <FormGroup label={t('common.password')} name="password" type="password" value={formData.password} onChange={handleChange} placeholder="••••••••" required />
                                <FormGroup label={t('auth.confirmPassword') || 'Confirm Password'} name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" required />
                            </div>
                        </div>

                        <div className="pt-4 flex flex-col space-y-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 flex items-center justify-center bg-indigo-600 text-white text-lg font-bold rounded-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/30 disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={24} />
                                ) : (
                                    <span className="flex items-center space-x-2">
                                        <span>{t('auth.registerButton')}</span>
                                        <ShieldCheck size={20} />
                                    </span>
                                )}
                            </button>

                            <Link to="/login" className="flex items-center justify-center space-x-2 text-slate-400 hover:text-white transition-colors py-2">
                                <ArrowLeft size={18} />
                                <span className="font-semibold">{t('auth.loginLink')}</span>
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

interface FormGroupProps {
    label: string;
    name: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
}

const FormGroup = ({ label, name, type = "text", value, onChange, placeholder, required = false }: FormGroupProps) => (
    <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">
            {label}
        </label>
        <input
            name={name}
            type={type}
            required={required}
            className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
        />
    </div>
);

export default RegisterPage;
