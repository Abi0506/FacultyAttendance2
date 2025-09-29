import axios from '../axios';
import { useAlert } from '../components/AlertProvider';
import PageWrapper from '../components/PageWrapper';
import React, { useState, useEffect } from 'react';

function DeviceManager() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState({ device_id: '', device_name: '', ip_address: '', device_location: '', maintenance: 0 });
  const [addForm, setAddForm] = useState({ device_name: '', ip_address: '', device_location: '', maintenance: 0 });
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const { showAlert } = useAlert();

  // Fetch devices on mount
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await axios.get("/attendance/devices");
        if (res.data.success) {
          setDevices(res.data.devices);
          setLoading(false);
        } else {
          showAlert('Failed to fetch devices', 'error');
        }
      } catch (error) {
        showAlert('Failed to fetch devices', 'error');
        console.error("Error fetching devices:", error);
      }
    };
    fetchDevices();
  }, []);

  // Filter devices based on showActiveOnly
  const filteredDevices = showActiveOnly ? devices.filter(device => device.maintenance === 0) : devices;

  // Handle edit button click
  const handleEditClick = (deviceId) => {
    const device = devices.find((d) => d.device_id === deviceId);
    if (device.maintenance) {
      showAlert('Cannot edit device under maintenance', 'error');
      return;
    }
    setEditingIdx(deviceId);
    setEditForm({ ...device });
  };

  // Handle delete button click
  const handleDeleteClick = async (deviceId) => {
    if (window.confirm("Are you sure you want to delete the device? This change cannot be reverted.")) {
      try {
        const res = await axios.post('/attendance/devices/delete', { id: deviceId });
        if (res.data.success) {
          showAlert("Device deleted successfully", "success");
          setDevices(devices.filter((device) => device.device_id !== deviceId));
        } else {
          showAlert('Failed to delete device', 'error');
        }
      } catch (error) {
        showAlert('Failed to delete device', 'error');
        console.error("Error deleting device:", error);
      }
    }
  };

  // Handle maintenance toggle
  const handleToggleMaintenance = async (deviceId) => {
    try {
      const res = await axios.post('/attendance/devices/toggle_maintenance', { id: deviceId });
      if (res.data.success) {
        setDevices(devices.map(device =>
          device.device_id === deviceId ? { ...device, maintenance: device.maintenance ? 0 : 1 } : device
        ));
        showAlert(res.data.message, 'success');
      } else {
        showAlert('Failed to toggle maintenance', 'error');
      }
    } catch (error) {
      showAlert('Failed to toggle maintenance', 'error');
      console.error("Error toggling maintenance:", error);
    }
  };

  // Handle edit form changes
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm({ ...editForm, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value });
  };

  // Save edited device
  const handleSave = async () => {
    try {
      const payload = {
        id: editForm.device_id,
        ip_address: editForm.ip_address,
        device_name: editForm.device_name,
        device_location: editForm.device_location,
        maintenance: editForm.maintenance,
      };
      const res = await axios.post('/attendance/devices/update', payload);
      if (res.data.success) {
        setDevices(devices.map((device) =>
          device.device_id === editForm.device_id ? { ...editForm } : device
        ));
        showAlert('Device updated successfully', 'success');
      } else {
        showAlert('Failed to update device', 'error');
      }
    } catch (error) {
      showAlert('Failed to update device', 'error');
      console.error('Error updating device:', error);
    }
    setEditingIdx(null);
  };

  // Cancel edit
  const handleCancel = () => {
    setEditingIdx(null);
  };

  // Handle add form changes
  const handleAddFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAddForm({ ...addForm, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value });
  };

  // Add new device
  const handleAddDevice = async (e) => {
    e.preventDefault();
    try {
      const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;
      if (!ipv4Regex.test(addForm.ip_address)) {
        showAlert('Invalid IP address format.', 'error');
        return;
      }
      const payload = { ...addForm };
      const res = await axios.post('/attendance/devices/add', payload);
      if (res.data.success && res.data.device) {
        setDevices([...devices, res.data.device]);
        setAddForm({ device_name: '', ip_address: '', device_location: '', maintenance: 0 });
        showAlert('Device added successfully', 'success');
      } else {
        setDevices([...devices, addForm]);
        showAlert('Device added (fallback)', 'success');
      }
    } catch (error) {
      showAlert(`Error: ${error.message}`, 'error');
      console.error("Error adding device:", error);
    }
  };

  return (
    <PageWrapper title="Device Manager">
      <div className="mb-5 p-4 rounded-3 bg-white shadow border border-light">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="text-primary fw-bold mb-0">Devices</h4>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="activeOnly"
              checked={showActiveOnly}
              onChange={() => setShowActiveOnly(!showActiveOnly)}
            />
            <label className="form-check-label" htmlFor="activeOnly">
              Active Devices Only
            </label>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="text-muted text-center py-4">
            No {showActiveOnly ? 'active' : ''} devices available.
          </div>
        ) : (
          <div className="d-flex gap-3 flex-wrap">
            {filteredDevices.map((device) => (
              <div
                key={device.device_id}
                className="card shadow-sm border-light rounded-3"
                style={{
                  width: '230px',
                  background: 'linear-gradient(180deg, #ffffff, #f9fafb)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
                }}
              >
                <div className="card-body p-3">
                  <div className="position-absolute d-flex gap-2" style={{ top: '12px', right: '12px' }}>
                    <button
                      className="btn btn-sm btn-outline-primary rounded-circle"
                      style={{ width: '34px', height: '34px' }}
                      onClick={() => handleEditClick(device.device_id)}
                      aria-label="Edit device"
                      disabled={device.maintenance}
                      title={device.maintenance ? 'Cannot edit: Device under maintenance' : 'Edit device'}
                    >
                      <i className="bi bi-pencil-fill fs-6"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger rounded-circle"
                      style={{ width: '34px', height: '34px' }}
                      onClick={() => handleDeleteClick(device.device_id)}
                      aria-label="Delete device"
                      title="Delete device"
                    >
                      <i className="bi bi-trash-fill fs-6"></i>
                    </button>
                    <button
                      className="btn btn-sm rounded-circle"
                      style={{
                        width: '34px',
                        height: '34px',
                        background: device.maintenance
                          ? 'linear-gradient(135deg, #ffca2c, #ffc107)'
                          : 'linear-gradient(135deg, #28a745, #20c997)',
                        border: 'none',
                        transition: 'background 0.2s',
                      }}
                      onClick={() => handleToggleMaintenance(device.device_id)}
                      aria-label={device.maintenance ? 'Disable Maintenance' : 'Enable Maintenance'}
                      title={device.maintenance ? 'Disable Maintenance' : 'Enable Maintenance'}
                    >
                      <i className={`bi ${device.maintenance ? 'bi-tools text-dark' : 'bi-gear-fill text-white'} fs-6`}></i>
                    </button>
                  </div>
                  {editingIdx === device.device_id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                      <input
                        className="form-control form-control-sm mb-2 shadow-sm rounded-3"
                        name="device_name"
                        value={editForm.device_name}
                        onChange={handleFormChange}
                        placeholder="Device Name"
                        required
                      />
                      <input
                        className="form-control form-control-sm mb-2 shadow-sm rounded-3"
                        name="ip_address"
                        value={editForm.ip_address}
                        onChange={handleFormChange}
                        placeholder="IP Address"
                        required
                      />
                      <input
                        className="form-control form-control-sm mb-2 shadow-sm rounded-3"
                        name="device_location"
                        value={editForm.device_location}
                        onChange={handleFormChange}
                        placeholder="Location"
                        required
                      />
                      <div className="form-check mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="maintenance"
                          checked={editForm.maintenance === 1}
                          onChange={handleFormChange}
                        />
                        <label className="form-check-label">Under Maintenance</label>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="submit"
                          className="btn btn-sm flex-grow-1 shadow-sm rounded-3"
                          style={{
                            background: 'linear-gradient(135deg, #007bff, #0056b3)',
                            border: 'none',
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm flex-grow-1 shadow-sm rounded-3"
                          onClick={handleCancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h6 className="card-title mb-2 fw-bold text-dark">{device.device_name}</h6>
                      <div className="small text-muted mb-1">{device.ip_address}</div>
                      <div className="small mb-3">{device.device_location}</div>
                      <span
                        className={`badge ${device.maintenance ? 'bg-warning text-dark' : 'bg-success text-white'} rounded-pill px-3 py-1 fs-6`}
                      >
                        {device.maintenance ? 'Under Maintenance' : 'Active'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mb-5 p-4 rounded-3 bg-white shadow border border-light">
        <h4 className="text-primary fw-bold mb-4">Add New Device</h4>
        <form className="row g-2 align-items-center" onSubmit={handleAddDevice}>
          <div className="col-auto">
            <input
              className="form-control form-control-sm shadow-sm rounded-3"
              style={{ maxWidth: '160px' }}
              name="device_name"
              value={addForm.device_name}
              onChange={handleAddFormChange}
              placeholder="Device Name"
              required
            />
          </div>
          <div className="col-auto">
            <input
              className="form-control form-control-sm shadow-sm rounded-3"
              style={{ maxWidth: '140px' }}
              name="ip_address"
              value={addForm.ip_address}
              onChange={handleAddFormChange}
              placeholder="IP Address"
              required
            />
          </div>
          <div className="col-auto">
            <input
              className="form-control form-control-sm shadow-sm rounded-3"
              style={{ maxWidth: '190px' }}
              name="device_location"
              value={addForm.device_location}
              onChange={handleAddFormChange}
              placeholder="Location"
              required
            />
          </div>
          <div className="col-auto">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                name="maintenance"
                checked={addForm.maintenance === 1}
                onChange={handleAddFormChange}
              />
              <label className="form-check-label">Under Maintenance</label>
            </div>
          </div>
          <div className="col-auto">
            <button
              type="submit"
              className="btn btn-sm shadow-sm rounded-3"
              style={{
                background: 'linear-gradient(135deg, #28a745, #20c997)',
                border: 'none',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #218838, #1a8c6d)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #28a745, #20c997)')}
            >
              Add Device
            </button>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}

export default DeviceManager;