// ResetPasswordPage.jsx
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "../axios";
import { useAlert } from '../components/AlertProvider';
import zxcvbn from "zxcvbn";

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const id = searchParams.get("id");


    const [valid, setValid] = useState(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: {} });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { showAlert } = useAlert();

    const passwordsMatch = confirmPassword === "" ? null : newPassword === confirmPassword;


    useEffect(() => {
        async function validateToken() {
            try {
                const res = await axios.get("/login/reset-password", { params: { token, id } });
                setValid(res.data.success);
            } catch {
                showAlert("Invalid or expired reset link", "error");
                setValid(false);
            }
        }
        validateToken();
    }, [token, id, showAlert]);

    const handlePasswordChange = (e) => {
        const pwd = e.target.value;
        setNewPassword(pwd);
        setPasswordStrength(zxcvbn(pwd));
    };

    const getStrengthColor = () => {
        switch (passwordStrength.score) {
            case 0: return "#ff4d4f";
            case 1: return "#ff7a45";
            case 2: return "#ffa940";
            case 3: return "#ffc53d";
            case 4: return "#52c41a";
            default: return "#ddd";
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (passwordStrength.score < 3) {
            showAlert("Password too weak. Please make it stronger.", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            showAlert("Passwords do not match.", "error");
            return;
        }

        try {
            const res = await axios.post("/login/reset-password/confirm", { token, id, newPassword });
            showAlert(res.data.message, res.data.success ? "success" : "error");
            if (res.data.success) window.location.href = "/login";
        } catch {
            showAlert("Failed to reset password", "error");
        }
    };

    if (valid === null) return <p>Checking link...</p>;
    if (!valid) return <p>Invalid or expired reset link</p>;

    return (
        <div className="reset-password-container">
            <div className="reset-password-card">
                <h2>Reset Your Password</h2>
                <form onSubmit={handleSubmit}>
                    {/* New Password */}
                    <div style={{ position: "relative", marginBottom: "16px" }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={handlePasswordChange}
                            className="reset-password-input"
                        />
                        <i
                            className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"} toggle-password`}
                            onClick={() => setShowPassword(!showPassword)}
                        ></i>
                    </div>

                    {/* Password Strength */}
                    {newPassword && (
                        <>
                            <div className="strength-bar-container">
                                <div
                                    className="strength-bar"
                                    style={{
                                        width: `${(passwordStrength.score + 1) * 20}%`,
                                        backgroundColor: getStrengthColor()
                                    }}
                                ></div>
                            </div>
                            <p className="strength-text" style={{ color: getStrengthColor() }}>
                                {passwordStrength.score === 0 && "Very Weak password"}
                                {passwordStrength.score === 1 && "Weak password"}
                                {passwordStrength.score === 2 && "Fair password"}
                                {passwordStrength.score === 3 && "Strong password"}
                                {passwordStrength.score === 4 && "Very Strong password"}
                                {passwordStrength.feedback.suggestions.length > 0 &&
                                    <span>: {passwordStrength.feedback.suggestions.join(", ")}</span>
                                }
                            </p>
                        </>
                    )}

                    {/* Confirm Password */}
                    <div style={{ position: "relative", marginBottom: "16px", marginTop: "16px" }}>
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="reset-password-input"
                        />
                        <i
                            className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"} toggle-password`}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        ></i>
                    </div>
                    {passwordsMatch !== null && (
                        <p
                            style={{
                                fontSize: "14px",
                                color: passwordsMatch ? "#52c41a" : "#ff4d4f",
                                margin: "4px 0 0 0"
                            }}
                        >
                            {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                        </p>
                    )}


                    <button type="submit" className="reset-password-button">Update Password</button>
                </form>
            </div>
        </div>
    );
}
