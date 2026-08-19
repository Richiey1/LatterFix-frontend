import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('payd_auth_token', token);
      // Optional: decode token to get user info or trigger a refresh in a context provider
      void navigate('/dashboard');
    } else {
      void navigate('/login?error=no_token');
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl font-bold tracking-tight">Authenticating...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
