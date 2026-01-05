import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User, Lock, Phone, UserCircle, Loader2, AlertCircle } from 'lucide-react';
import { UserRole } from '../types';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: UserRole.EMPLOYEE
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        setSuccess('Đăng ký thành công! Vui lòng chờ Quản trị viên duyệt tài khoản.');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng ký thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gray-900 px-8 py-8 text-center text-white">
          <h1 className="text-2xl font-bold">Tạo tài khoản mới</h1>
          <p className="mt-2 text-gray-400">Tham gia hệ thống VinFast CRM</p>
        </div>

        <div className="px-8 py-8">
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 rounded-lg bg-green-50 p-6 text-center border border-green-100">
              <div className="mb-3 flex justify-center text-green-600">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
                      <Loader2 className="animate-spin" size={0} />
                      <span className="text-2xl">✓</span>
                  </div>
              </div>
              <p className="font-bold text-lg text-green-800 mb-1">Đăng ký thành công!</p>
              <p className="text-sm text-green-700">{success}</p>
              <Link to="/login" className="mt-6 inline-block w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-green-700 transition-all">
                Quay lại đăng nhập
              </Link>
            </div>
          )}

          {!success && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Họ và tên</label>
                    <div className="relative">
                      <UserCircle className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input
                        name="fullName"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 font-medium"
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Số điện thoại</label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input
                        name="phone"
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 font-medium"
                        placeholder="09xx..."
                      />
                    </div>
                  </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Email đăng nhập</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 font-medium"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Mật khẩu</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 font-medium"
                    placeholder="Ít nhất 6 ký tự"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 border border-blue-100">
                 <AlertCircle size={16} className="shrink-0 mt-0.5" />
                 <p>Hệ thống tự động đồng bộ thông tin của bạn. Sau khi đăng ký, vui lòng liên hệ Admin để được duyệt quyền truy cập.</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 font-semibold text-white shadow-lg shadow-gray-200 transition-all hover:bg-black hover:shadow-xl disabled:opacity-70"
              >
                {isLoading && <Loader2 className="animate-spin" size={20} />}
                {isLoading ? 'Đang xử lý...' : 'Gửi yêu cầu đăng ký'}
              </button>
            </form>
          )}

          {!success && (
            <div className="mt-6 text-center text-sm text-gray-500">
              Đã có tài khoản?{' '}
              <Link to="/login" className="font-semibold text-gray-900 hover:underline">
                Đăng nhập
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-sm text-gray-600 font-medium">Ứng dụng được phát triển bởi <span className="text-primary-600 font-bold">Nguyên Hồ !</span></p>
        <p className="text-xs text-gray-500 border-t border-gray-200 pt-2 inline-block px-4">Hotline báo lỗi : <span className="font-bold text-gray-800">0908795453</span></p>
      </div>
    </div>
  );
};

export default Register;