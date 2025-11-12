import axios from '../axios';
import { useAlert } from '../components/AlertProvider';
import PageWrapper from '../components/PageWrapper';
import React, { useState, useEffect } from 'react';
import { Tooltip } from 'bootstrap';

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
      setLoading(true);
      try {
        const res = await axios.get("/devices/all");
        if (res.data.success) {
          setDevices(res.data.devices);
          setLoading(false);
        } else {
          showAlert('Failed to fetch devices', 'error');
        }
      } catch (error) {
        showAlert('Failed to fetch devices', 'error');
        console.error("Error fetching devices:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
  }, []);

  const filteredDevices = showActiveOnly ? devices.filter(d => d.maintenance === 0) : devices;

  const handleEditClick = (deviceId) => {
    const device = devices.find(d => d.device_id === deviceId);
    if (device.maintenance) {
      showAlert('Cannot edit device under maintenance', 'error');
      return;
    }
    setEditingIdx(deviceId);
    setEditForm({ ...device });
  };

  const handleDeleteClick = async (deviceId) => {
    if (!window.confirm("Are you sure you want to delete this device?")) return;
    try {
      const res = await axios.post('/devices/delete', { id: deviceId });
      if (res.data.success) {
        setDevices(devices.filter(d => d.device_id !== deviceId));
        showAlert('Device deleted successfully', 'success');
      } else showAlert('Failed to delete device', 'error');
    } catch (error) {
      showAlert('Failed to delete device', 'error');
      console.error("Error deleting device:", error);
    }
  };

  const handleToggleMaintenance = async (deviceId, currentStatus) => {
    const confirmMessage = currentStatus
      ? "Are you sure you want to turn OFF maintenance?"
      : "Are you sure you want to turn ON maintenance? Once turned ON, the records will not be fetched from the device."

    if (!window.confirm(confirmMessage)) return;
    try {
      const res = await axios.post('/devices/toggle_maintenance', { id: deviceId });
      if (res.data.success) {
        setDevices(devices.map(d => d.device_id === deviceId ? { ...d, maintenance: d.maintenance ? 0 : 1 } : d));
        showAlert(res.data.message, 'success');
      } else showAlert('Failed to toggle maintenance', 'error');
    } catch (error) {
      showAlert('Failed to toggle maintenance', 'error');
      console.error("Error toggling maintenance:", error);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm({ ...editForm, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value });
  };

  const handleSave = async () => {
    try {
      const payload = { ...editForm, id: editForm.device_id };
      const res = await axios.post('/devices/update', payload);
      if (res.data.success) {
        setDevices(devices.map(d => d.device_id === editForm.device_id ? { ...editForm } : d));
        showAlert('Device updated successfully', 'success');
      } else showAlert('Failed to update device', 'error');
    } catch (error) {
      showAlert('Failed to update device', 'error');
      console.error('Error updating device:', error);
    }
    setEditingIdx(null);
  };

  const handleCancel = () => setEditingIdx(null);

  const handleAddFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAddForm({ ...addForm, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value });
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    try {
      const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;
      if (!ipv4Regex.test(addForm.ip_address)) {
        showAlert('Invalid IP address format', 'error');
        return;
      }
      const res = await axios.post('/devices/add', { ...addForm });
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

  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(
      el => new Tooltip(el, { trigger: 'hover' })
    );

    return () => tooltipList.forEach(t => t.dispose());
  }, [devices, editingIdx, showActiveOnly]);


  return (
    <PageWrapper title="Device Manager">
      {/* Device List */}
      <div className="mb-5 p-4 rounded-4 bg-light border">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="text-primary fw-bold mb-0">Devices</h4>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="activeOnly"
              checked={showActiveOnly}
              onChange={() => setShowActiveOnly(!showActiveOnly)}
            />
            <label className="form-check-label" htmlFor="activeOnly">Active Devices Only</label>
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
            {filteredDevices.map(device => (
              <div key={device.device_id} className="device-card card p-3 shadow-sm">
                <div className="card-actions">
                  {editingIdx !== device.device_id && (
                    <>
                      <button
                        className="edit-btn edit-c-btn"
                        onClick={() => handleEditClick(device.device_id)}
                        disabled={device.maintenance}
                        data-bs-toggle="tooltip"
                        data-bs-placement="top"
                        data-bs-title={device.maintenance ? 'Cannot edit: Device under maintenance' : 'Edit device'}
                      >
                        <i className="bi bi-pencil-fill"></i>
                      </button>

                      <button
                        className="delete-btn delete-c-btn"
                        onClick={() => handleDeleteClick(device.device_id)}
                        data-bs-toggle="tooltip"
                        data-bs-placement="top"
                        data-bs-title="Delete device"
                      >
                        <i className="bi bi-trash-fill"></i>
                      </button>

                      <button
                        className={`maintenance-btn ${device.maintenance ? 'maintenance' : 'active'}`}
                        onClick={() => handleToggleMaintenance(device.device_id, device.maintenance)}
                        data-bs-toggle="tooltip"
                        data-bs-placement="top"
                        data-bs-title={device.maintenance ? 'Disable Maintenance' : 'Enable Maintenance'}
                      >
                        <i className="bi bi-tools"></i>
                      </button>

                    </>
                  )}
                </div>


                {editingIdx === device.device_id ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <input
                      className="form-control mb-2"
                      name="device_name"
                      value={editForm.device_name}
                      onChange={handleFormChange}
                      placeholder="Device Name"
                      required
                    />
                    <input
                      className="form-control mb-2"
                      name="ip_address"
                      value={editForm.ip_address}
                      onChange={handleFormChange}
                      placeholder="IP Address"
                      required
                    />
                    <input
                      className="form-control mb-2"
                      name="device_location"
                      value={editForm.device_location}
                      onChange={handleFormChange}
                      placeholder="Location"
                      required
                    />
                    <div className="form-check mb-2">
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
                      <button type="submit" className="btn btn-primary flex-grow-1">Save</button>
                      <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={handleCancel}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h6 className="fw-bold">{device.device_name}</h6>
                    <div className="text-muted small">{device.ip_address}</div>
                    <div className="text-muted small mb-2">{device.device_location}</div>
                    <span className={`badge ${device.maintenance ? 'bg-warning text-dark' : 'bg-success text-white'}`}>
                      {device.maintenance ? 'Under Maintenance' : 'Active'}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Device */}
      <div className="mb-5 p-4 rounded-4 bg-light border">
        <h4 className="text-primary fw-bold mb-3">Add New Device</h4>
        <form className="row g-2 align-items-center" onSubmit={handleAddDevice}>
          <div className="col-auto">
            <input className="form-control form-control-sm" style={{ width: '160px' }} name="device_name" value={addForm.device_name} onChange={handleAddFormChange} placeholder="Device Name" required />
          </div>
          <div className="col-auto">
            <input className="form-control form-control-sm" style={{ width: '140px' }} name="ip_address" value={addForm.ip_address} onChange={handleAddFormChange} placeholder="IP Address" required />
          </div>
          <div className="col-auto">
            <input className="form-control form-control-sm" style={{ width: '180px' }} name="device_location" value={addForm.device_location} onChange={handleAddFormChange} placeholder="Location" required />
          </div>
          <div className="col-auto">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                name="maintenance"
                id="maintenanceToggle"
                checked={addForm.maintenance === 1}
                onChange={handleAddFormChange}
              />
              <label className="form-check-label" htmlFor="maintenanceToggle">
                Under Maintenance
              </label>
            </div>
          </div>

          <div className="col-auto">
            <button type="submit" className="btn btn-c-primary btn-sm">Add Device</button>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}

export default DeviceManager;
