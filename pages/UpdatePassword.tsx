import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const { useNavigate } = ReactRouterDOM as any;

const UpdatePassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Kiểm tra xem user có thực sự đang trong phiên recovery không
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Nếu không có session (ví dụ người dùng vào thẳng link này mà không qua email), đẩy về login
        navigate('/login');
      }
    });
  }, [navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000); // Redirect to dashboard after 2 seconds

    } catch (err: any) {
      setError(err.message || 'Lỗi cập nhật mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-primary-600 px-8 py-8 text-center text-white">
          <h1 className="text-2xl font-bold">Đặt lại mật khẩu</h1>
          <p className="mt-1 text-primary-100">Nhập mật khẩu mới cho tài khoản của bạn</p>
        </div>

        <div className="px-8 py-10">
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success ? (
             <div className="text-center py-6 animate-fade-in">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                   <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Thành công!</h3>
                <p className="text-gray-500 mt-2">Mật khẩu đã được cập nhật. Đang chuyển hướng...</p>
             </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Mật khẩu mới</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 font-medium"
                    placeholder="••••••"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Nhập lại mật khẩu</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 font-medium"
                    placeholder="••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-primary-600 py-3 font-bold text-white shadow-lg hover:bg-primary-700 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isLoading && <Loader2 className="animate-spin" size={20} />}
                Cập nhật mật khẩu
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdatePassword;