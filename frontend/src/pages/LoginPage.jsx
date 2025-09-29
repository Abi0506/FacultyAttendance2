import React, { useState } from 'react';
import axios from '../axios';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/PageWrapper';
import { useAuth } from '../auth/authProvider';
import { useAlert } from '../components/AlertProvider';
import { ScaleLoader } from "react-spinners";

function LoginPage() {
  const [formData, setFormData] = useState({ userIdorEmail: '', password: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showAlert } = useAlert();

  const handleResetPassword = async () => {
    if (!resetEmail) {
      showAlert('Please enter your email to reset password', 'warning');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post("/login/reset-password", { UserOrEmail: resetEmail });
      if (res.data.success) {
        showAlert(res.data.message || 'Password reset link sent to your email!', 'success');
      } else {
        showAlert(res.data.message || 'Failed to send reset link. Try again.', 'error');
      }
      setLoading(false);
      setShowResetModal(false);
      setResetEmail('');
    } catch (error) {
      showAlert('Failed to send reset link. Try again.', 'error');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await login(formData);
      if (result.success) {
        showAlert('Login successful!', 'success');
        if (result.designation === 'HR') {
          navigate('/view', { replace: true });
        } else if (result.designation) {
          navigate('/staffIndividualReport', { replace: true });
        } else {
          showAlert('Unknown designation. Redirecting to dashboard.', 'warning');
        }
      } else if (result.reason === 'invalid_credentials') {
        showAlert('Invalid User ID or Password', 'error');
      } else {
        showAlert('An error occurred during login. Please try again.', 'error');
      }
    } catch (error) {
      showAlert('An error occurred during login. Please try again.', 'error');
    }
  };

  return (
    <div className="w-50 m-auto">
      <PageWrapper title="Login">

        {/* Social logins */}
        <div className="text-center mb-3">
          <button
            className="btn btn-outline-danger me-2"
            onClick={() => window.location.href = 'http://localhost:5050/auth/google'}
          >
            <i className="bi bi-google me-2"></i> Google
          </button>

        </div>

        {/* Divider */}
        <div className="d-flex align-items-center my-3">
          <hr className="flex-grow-1" />
          <span className="mx-2 text-muted small">OR</span>
          <hr className="flex-grow-1" />
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-medium">User ID / Email</label>
            <input
              type="text"
              name="userIdorEmail"
              value={formData.userIdorEmail}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label fw-medium">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          {/* Remember me + Reset password */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="rememberMe" />
              <label className="form-check-label small" htmlFor="rememberMe">
                Remember me
              </label>
            </div>
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              onClick={() => { setShowResetModal(true); setResetEmail(formData.userIdorEmail); }}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="btn btn-primary w-100 mb-2">Login</button>
        </form>
      </PageWrapper>

      {/* Reset Password Modal */}
      {showResetModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(3px)' }}></div>
          <div className="modal show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Reset Password</h5>
                  <button type="button" className="btn-close" onClick={() => setShowResetModal(false)}></button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Enter your ID or Email</label>
                  <input
                    type="email"
                    value={resetEmail || formData.userIdorEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="form-control"
                    placeholder="example@email.com"
                    required
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => setShowResetModal(false)}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleResetPassword}
                    disabled={loading}
                  >
                    Send Reset Link
                    {loading && (
                      <span style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }}>
                        <ScaleLoader color="#fff" height={10} width={3} margin={2} loading={loading} />
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LoginPage;
