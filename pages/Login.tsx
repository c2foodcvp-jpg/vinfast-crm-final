import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User, Lock, Loader2, AlertCircle, ShieldCheck, Mail, ArrowLeft, ChevronRight, ArrowRight } from 'lucide-react';

const { useNavigate, Link } = ReactRouterDOM as any;

const Login: React.FC = () => {
    const [loginLogo, setLoginLogo] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogo = async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'system_logo_login').maybeSingle();
            if (data?.value) setLoginLogo(data.value);
        };
        fetchLogo();
    }, []);

    // ... (rest of states)

    const [emailOrPhone, setEmailOrPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const navigate = useNavigate();

    // ... (rest of handlers)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            let emailToUse = emailOrPhone.trim();
            emailToUse = emailToUse.replace(/\s/g, '');

            const isPhone = /^[0-9+]{9,15}$/.test(emailToUse);

            if (isPhone) {
                if (emailToUse === '0865159009') {
                    emailToUse = 'cskh.vinfasthcm@gmail.com';
                } else {
                    const { data } = await supabase.from('profiles').select('email').eq('phone', emailToUse).maybeSingle();
                    if (data?.email) emailToUse = data.email;
                }
            }

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password: password,
            });

            if (authError) throw authError;

            if (authData.session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('status, role, full_name, team_expiration_date, manager_id')
                    .eq('id', authData.user.id)
                    .single();

                const isSuperAdmin = authData.user.email === 'cskh.vinfasthcm@gmail.com';

                if (!isSuperAdmin && profile) {
                    // 1. Check Account Status
                    if (profile.status === 'pending') {
                        await supabase.auth.signOut();
                        setError(`Tài khoản "${profile.full_name}" đang chờ duyệt. Vui lòng liên hệ Admin.`);
                        setIsLoading(false);
                        return;
                    }
                    if (profile.status === 'blocked') {
                        await supabase.auth.signOut();
                        setError('Tài khoản của bạn đã bị khóa.');
                        setIsLoading(false);
                        return;
                    }

                    // 2. Check Team Expiration (New Feature)
                    const now = new Date();
                    let isExpired = false;

                    // a) For MOD: Check own expiration
                    if (profile.role === 'mod' && profile.team_expiration_date) {
                        const expDate = new Date(profile.team_expiration_date);
                        if (now > expDate) isExpired = true;
                    }
                    // b) For Employee: Check Manager's expiration
                    else if (profile.role === 'employee' && profile.manager_id) {
                        const { data: manager } = await supabase
                            .from('profiles')
                            .select('team_expiration_date')
                            .eq('id', profile.manager_id)
                            .maybeSingle();

                        if (manager?.team_expiration_date) {
                            const expDate = new Date(manager.team_expiration_date);
                            if (now > expDate) isExpired = true;
                        }
                    }

                    if (isExpired) {
                        await supabase.auth.signOut();
                        setError('Tài khoản của bạn đã hết hạn vui lòng liên hệ Admin để gia hạn !');
                        setIsLoading(false);
                        return;
                    }
                }
                navigate('/');
            }
        } catch (err: any) {
            if (err.message.includes('Invalid login')) {
                setError('Sai thông tin đăng nhập.');
            } else {
                setError(err.message || 'Lỗi đăng nhập.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ... (reset password handler)
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        if (!recoveryEmail) {
            setError('Vui lòng nhập email.');
            setIsLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
                redirectTo: window.location.origin + '/#/update-password',
            });

            if (error) throw error;

            setSuccess('Đã gửi liên kết khôi phục mật khẩu. Vui lòng kiểm tra email của bạn.');
        } catch (err: any) {
            setError(err.message || 'Không thể gửi email khôi phục.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
            {/* Background Abstract Shapes */}
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary-600/20 blur-[120px]"></div>
            <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[100px]"></div>

            {/* Intro Navigation Button (Top Right) */}
            <Link
                to="/intro"
                className="absolute top-6 right-6 z-50 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/20 shadow-xl transition-all hover:scale-105 active:scale-95 group flex items-center gap-3"
                title="Giới thiệu Hệ thống"
            >
                <span className="font-semibold text-sm">Tìm hiểu hệ thống CRM</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            <div className="relative w-full max-w-[1000px] bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 flex flex-col md:flex-row m-4 animate-fade-in">

                {/* Left Side: Brand Area */}
                <div className="hidden md:flex flex-col justify-between w-1/2 p-10 bg-gradient-to-br from-primary-900/80 to-slate-900/80 text-white relative">
                    <div className="relative z-10">
                        {loginLogo ? (
                            <div className="mb-6">
                                <img
                                    src={loginLogo}
                                    alt="Company Logo"
                                    className="max-w-[180px] h-auto object-contain max-h-[80px]"
                                />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 mb-6">
                                <span className="font-bold text-2xl">V</span>
                            </div>
                        )}
                        <h1 className="text-4xl font-bold mb-4 leading-tight">Quản lý khách hàng<br /><span className="text-primary-400">Chuyên nghiệp</span></h1>
                        <p className="text-blue-100/80 text-sm leading-relaxed max-w-sm">
                            Hệ thống CRM tối ưu dành riêng cho đội ngũ kinh doanh VinFast. Tăng tốc độ chốt đơn, quản lý dòng tiền và chăm sóc khách hàng hiệu quả.
                        </p>
                    </div>
                    <div className="relative z-10 text-xs text-blue-200/50">
                        © 2025 VinFast CRM Enterprise by Nguyên Hồ
                    </div>

                    {/* Overlay Pattern */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                </div>

                {/* Right Side: Form Area */}
                <div className="w-full md:w-1/2 bg-white p-8 md:p-12">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-800">
                            {isForgotPassword ? 'Khôi phục mật khẩu' : 'Đăng nhập hệ thống'}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            {isForgotPassword ? 'Nhập email để nhận liên kết đặt lại.' : 'Chào mừng bạn quay trở lại!'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100 animate-fade-in">
                            <AlertCircle size={18} className="shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-600 border border-green-100 animate-fade-in">
                            <ShieldCheck size={18} className="shrink-0" />
                            <p>{success}</p>
                        </div>
                    )}

                    {!isForgotPassword ? (
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Tài khoản</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        required
                                        value={emailOrPhone}
                                        onChange={(e) => setEmailOrPhone(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-slate-900 outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 transition-all font-medium"
                                        placeholder="Email hoặc Số điện thoại"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mật khẩu</label>
                                    <button
                                        type="button"
                                        onClick={() => { setIsForgotPassword(true); setError(null); setSuccess(null); }}
                                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                                    >
                                        Quên mật khẩu?
                                    </button>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-slate-900 outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 transition-all font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="rememberMe"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                                />
                                <label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer select-none font-medium">Duy trì đăng nhập</label>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-blue-600 py-3.5 font-bold text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2 transition-all mt-2"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        Đăng nhập <ChevronRight size={18} />
                                    </>
                                )}
                            </button>

                            <div className="text-center mt-6">
                                <p className="text-sm text-slate-500">
                                    Chưa có tài khoản?{' '}
                                    <Link to="/register" className="text-primary-600 font-bold hover:underline">
                                        Đăng ký ngay
                                    </Link>
                                </p>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Email đăng ký</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        value={recoveryEmail}
                                        onChange={(e) => setRecoveryEmail(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-slate-900 outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 transition-all font-medium"
                                        placeholder="nhanvien@vinfast.vn"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white shadow-lg hover:bg-black disabled:opacity-70 flex justify-center items-center gap-2 transition-all"
                            >
                                {isLoading && <Loader2 className="animate-spin" size={20} />}
                                Gửi liên kết
                            </button>

                            <button
                                type="button"
                                onClick={() => { setIsForgotPassword(false); setError(null); setSuccess(null); }}
                                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors py-2"
                            >
                                <ArrowLeft size={16} /> Quay lại đăng nhập
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Mobile Footer */}
            <div className="absolute bottom-4 left-0 w-full text-center md:hidden">
                <p className="text-xs text-white/30">Developed by Nguyen Ho</p>
            </div>
        </div>
    );
};

export default Login;
