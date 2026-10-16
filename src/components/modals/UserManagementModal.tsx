import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  User,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Check,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle2,
  XCircle,
  Save,
  Plus,
  Trash2,
  Briefcase,
  Mail,
  Building,
  AlertCircle,
  X,
  UserPlus,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { AuthUser, StoredUserAccount, ViewerPermissions, UserRole } from '../../types';
import {
  getStoredUsers,
  updateStoredUserAccount,
  updateSpecificUserPermissions,
  createStoredUserAccount,
  deleteStoredUserAccount,
  DEFAULT_VIEWER_PERMISSIONS,
  FULL_ADMIN_PERMISSIONS,
} from '../../data/authData';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onUserUpdated: (updatedCurrentUser: AuthUser) => void;
}

const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-emerald-600 to-teal-600',
  'from-purple-600 to-indigo-600',
  'from-rose-600 to-pink-600',
  'from-amber-600 to-orange-600',
  'from-cyan-600 to-blue-600',
];

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
}) => {
  const [users, setUsers] = useState<StoredUserAccount[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Edit form state for selected user
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('viewer');
  const [formRoleLabel, setFormRoleLabel] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete confirmation
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);

  // Permissions state for selected user
  const [permissions, setPermissions] = useState<ViewerPermissions>({ ...DEFAULT_VIEWER_PERMISSIONS });

  // Creation form state (for admin)
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('viewer');
  const [newRoleLabel, setNewRoleLabel] = useState('Investigador & Consultor');
  const [newDepartment, setNewDepartment] = useState('Licitaciones & Consultas');
  const [newAvatarColor, setNewAvatarColor] = useState(AVATAR_GRADIENTS[2]);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPermissions, setNewPermissions] = useState<ViewerPermissions>({ ...DEFAULT_VIEWER_PERMISSIONS });

  const isAdmin = currentUser?.role === 'admin';

  // Load users on open (only re-initialize on modal open transition)
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredUsers();
      setUsers(stored);
      setIsCreatingNew(false);
      setUserToDeleteId(null);
      
      // Preserve currently selected user if still valid, otherwise pick initial target
      setSelectedUserId((prevSelectedId) => {
        const existing = prevSelectedId ? stored.find((u) => u.id === prevSelectedId) : null;
        if (existing) {
          selectUser(existing);
          return existing.id;
        }
        const targetUser = stored.find((u) => u.id === currentUser?.id) || stored[0];
        if (targetUser) {
          selectUser(targetUser);
          return targetUser.id;
        }
        return '';
      });

      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Synchronize in real-time when users update in storage or via Firestore event
  useEffect(() => {
    const handleUsersUpdate = (e: any) => {
      const freshUsers: StoredUserAccount[] = e?.detail || getStoredUsers();
      setUsers(freshUsers);

      if (isOpen) {
        setSelectedUserId((prevSelectedId) => {
          const targetId = prevSelectedId || currentUser?.id;
          const updated = freshUsers.find((u) => u.id === targetId);
          if (updated) {
            if (updated.role === 'admin') {
              setPermissions({ ...FULL_ADMIN_PERMISSIONS });
            } else if (updated.permissions) {
              setPermissions(updated.permissions);
            }
            return updated.id;
          }
          return prevSelectedId;
        });
      }
    };

    window.addEventListener('syd_users_updated', handleUsersUpdate as EventListener);
    return () => {
      window.removeEventListener('syd_users_updated', handleUsersUpdate as EventListener);
    };
  }, [isOpen, currentUser?.id]);

  // Synchronize non-admin active viewer permissions live when currentUser prop changes
  useEffect(() => {
    if (isOpen && currentUser && !isAdmin) {
      const stored = getStoredUsers();
      setUsers(stored);
      const myAccount = stored.find((u) => u.id === currentUser.id || u.username.toLowerCase() === currentUser.username.toLowerCase());
      if (myAccount) {
        selectUser(myAccount);
      }
    }
  }, [isOpen, currentUser, isAdmin]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (userToDeleteId) {
          setUserToDeleteId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, userToDeleteId, onClose]);

  const selectUser = (user: StoredUserAccount) => {
    setIsCreatingNew(false);
    setSelectedUserId(user.id);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPassword(user.password || '');
    setFormEmail(user.email || '');
    setFormRole(user.role);
    setFormRoleLabel(user.roleLabel || (user.role === 'admin' ? 'Administrador Total' : 'Investigador & Descargas'));
    setFormDepartment(user.department || 'Operaciones');
    setShowPassword(false);
    setSuccessMessage(null);
    setErrorMessage(null);

    if (user.role === 'admin') {
      setPermissions({ ...FULL_ADMIN_PERMISSIONS });
    } else if (user.permissions) {
      setPermissions(user.permissions);
    } else {
      setPermissions({ ...DEFAULT_VIEWER_PERMISSIONS });
    }
  };

  if (!isOpen) return null;

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!selectedUserId || !selectedUser) return;

    if (!formPassword.trim()) {
      setErrorMessage('La contraseña no puede estar vacía.');
      return;
    }

    if (isAdmin) {
      if (!formName.trim()) {
        setErrorMessage('El nombre no puede estar vacío.');
        return;
      }
      if (!formUsername.trim()) {
        setErrorMessage('El usuario no puede estar vacío.');
        return;
      }

      // Check duplicate username if changed
      const usernameTaken = users.some(
        (u) => u.id !== selectedUserId && u.username.toLowerCase() === formUsername.trim().toLowerCase()
      );
      if (usernameTaken) {
        setErrorMessage(`El nombre de usuario "${formUsername.trim()}" ya está en uso por otra cuenta.`);
        return;
      }
    }

    const updatedUserPermissions = formRole === 'admin' ? { ...FULL_ADMIN_PERMISSIONS } : permissions;

    // Non-admin can only update their own password
    const updates: Partial<StoredUserAccount> = isAdmin
      ? {
          name: formName.trim(),
          username: formUsername.trim(),
          password: formPassword.trim(),
          email: formEmail.trim() || `${formUsername.trim().toLowerCase()}@syd.com.co`,
          role: formRole,
          roleLabel: formRoleLabel.trim() || (formRole === 'admin' ? 'Administrador Total' : 'Investigador & Descargas'),
          department: formDepartment.trim() || 'General',
          permissions: updatedUserPermissions,
        }
      : {
          password: formPassword.trim(),
        };

    const updatedList = updateStoredUserAccount(selectedUserId, updates);
    setUsers(updatedList);
    setSuccessMessage(
      isAdmin
        ? `¡Datos y credenciales actualizados correctamente para ${formName.trim()}!`
        : `¡Su contraseña personal ha sido actualizada con éxito!`
    );

    // If current logged-in user was updated, notify parent
    if (currentUser && currentUser.id === selectedUserId) {
      const freshCurrent = updatedList.find((u) => u.id === selectedUserId);
      if (freshCurrent) {
        const { password, ...safe } = freshCurrent;
        onUserUpdated(safe);
      }
    }

    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const handleTogglePermission = (key: keyof ViewerPermissions) => {
    if (!isAdmin || !selectedUserId) return;
    const targetUser = users.find((u) => u.id === selectedUserId);
    if (!targetUser || targetUser.role === 'admin') return;

    setPermissions((prev) => {
      const newPerms: ViewerPermissions = {
        ...prev,
        [key]: !prev[key],
      };

      const updatedList = updateSpecificUserPermissions(selectedUserId, newPerms);
      setUsers(updatedList);

      // If current user is modified user, update parent state
      if (currentUser?.id === selectedUserId) {
        const fresh = updatedList.find((u) => u.id === selectedUserId);
        if (fresh) {
          const { password, ...safe } = fresh;
          onUserUpdated(safe);
        }
      }

      return newPerms;
    });

    setSuccessMessage(`Permiso actualizado en tiempo real para ${targetUser.name}.`);

    setTimeout(() => {
      setSuccessMessage(null);
    }, 2500);
  };

  const handleSetAllPermissions = (enableAll: boolean) => {
    if (!isAdmin || !selectedUser) return;
    if (selectedUser.role === 'admin') return;

    const newPerms: ViewerPermissions = {
      canEditSales: enableAll,
      canEditCostManager: enableAll,
      canEditCatalog: enableAll,
      canEditTenders: enableAll,
      canManageOCTracking: enableAll,
      canEditDocuments: enableAll,
      canManageSalesOrders: enableAll,
      canManageQuotesHistory: enableAll,
      canManageSuppliers: enableAll,
      canManageSerials: enableAll,
      canManageCustomization: enableAll,
      canExportData: enableAll,
      canManageBackups: enableAll,
      canAccessSqlAnalytics: enableAll,
      canManageGmailPurchases: enableAll,
    };
    setPermissions(newPerms);

    const updatedList = updateSpecificUserPermissions(selectedUserId, newPerms);
    setUsers(updatedList);
    setSuccessMessage(
      enableAll
        ? `Se han habilitado todos los permisos de edición para ${selectedUser.name}.`
        : `Se han revocado todos los permisos de edición para ${selectedUser.name} (Modo Solo Lectura).`
    );

    if (currentUser?.id === selectedUserId) {
      const fresh = updatedList.find((u) => u.id === selectedUserId);
      if (fresh) {
        const { password, ...safe } = fresh;
        onUserUpdated(safe);
      }
    }

    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  // Creation of new user handler (Admin only)
  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newName.trim()) {
      setErrorMessage('Ingrese el nombre completo del nuevo usuario.');
      return;
    }
    if (!newUsername.trim()) {
      setErrorMessage('Ingrese un nombre de usuario para el inicio de sesión.');
      return;
    }
    if (!newPassword.trim()) {
      setErrorMessage('Ingrese una contraseña inicial.');
      return;
    }

    // Check duplicate username
    const usernameTaken = users.some(
      (u) => u.username.toLowerCase() === newUsername.trim().toLowerCase()
    );
    if (usernameTaken) {
      setErrorMessage(`El nombre de usuario "${newUsername.trim()}" ya existe en el sistema.`);
      return;
    }

    const { users: updatedList, createdUser } = createStoredUserAccount({
      name: newName.trim(),
      username: newUsername.trim(),
      password: newPassword.trim(),
      email: newEmail.trim() || `${newUsername.trim().toLowerCase()}@syd.com.co`,
      role: newRole,
      roleLabel: newRoleLabel.trim() || (newRole === 'admin' ? 'Administrador Total' : 'Investigador & Descargas'),
      department: newDepartment.trim() || 'Licitaciones & Consultas',
      avatarColor: newAvatarColor,
      permissions: newRole === 'admin' ? { ...FULL_ADMIN_PERMISSIONS } : newPermissions,
    });

    setUsers(updatedList);
    setIsCreatingNew(false);
    selectUser(createdUser);
    setSuccessMessage(`¡Usuario ${createdUser.name} (@${createdUser.username}) creado con éxito!`);

    // Reset creation fields
    setNewName('');
    setNewUsername('');
    setNewPassword('');
    setNewEmail('');
    setNewRole('viewer');
    setNewRoleLabel('Investigador & Consultor');
    setNewDepartment('Licitaciones & Consultas');
    setNewPermissions({ ...DEFAULT_VIEWER_PERMISSIONS });

    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const handleDeleteUser = (userId: string) => {
    if (!isAdmin) return;
    if (userId === 'user-admin-1') {
      setErrorMessage('No es posible eliminar la cuenta principal de Administrador.');
      return;
    }
    if (userId === currentUser?.id) {
      setErrorMessage('No puede eliminar el usuario con el que tiene la sesión activa actualmente.');
      return;
    }

    const updated = deleteStoredUserAccount(userId);
    setUsers(updated);
    setUserToDeleteId(null);
    const target = updated.find((u) => u.role === 'admin') || updated[0];
    if (target) {
      selectUser(target);
    }
    setSuccessMessage('Usuario eliminado correctamente del sistema.');
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const permissionItems: {
    key: keyof ViewerPermissions;
    title: string;
    description: string;
    badge: string;
  }[] = [
    {
      key: 'canEditSales',
      title: 'Cotizaciones & Ventas (Pestaña 1)',
      description: 'Permite editar cabecera (cliente, NIT, validez), agregar/eliminar equipos, modificar descuentos y notas.',
      badge: 'Ventas',
    },
    {
      key: 'canEditCostManager',
      title: 'Gestor de Costos & Precios (Pestaña 2)',
      description: 'Permite cambiar listas de factores (L1–L8), precio manual, márgenes de ganancia y actualizar costos al catálogo.',
      badge: 'Costos',
    },
    {
      key: 'canEditCatalog',
      title: 'Catálogo Maestro de Equipos (Pestaña 3)',
      description: 'Permite crear nuevos equipos médicos, editar costos base, registros INVIMA e importar catálogo desde Excel.',
      badge: 'Catálogo',
    },
    {
      key: 'canEditTenders',
      title: 'Licitaciones & Anexos Técnicos (Pestaña 4)',
      description: 'Permite editar requisitos técnicos, folios de pliegos, porcentajes de cumplimiento y cantidades en licitaciones.',
      badge: 'Licitaciones',
    },
    {
      key: 'canManageOCTracking',
      title: 'Seguimiento de Órdenes de Compra (OC) (Pestaña 5)',
      description: 'Permite crear OCs a proveedores, actualizar estados de despacho/pago, registrar guías y novedades logísticas.',
      badge: 'Seguimiento OC',
    },
    {
      key: 'canEditDocuments',
      title: 'Documentación Técnica Oficial (Pestaña 6)',
      description: 'Permite adjuntar nuevos archivos sanitarios, manuales de usuario/servicio y eliminar documentos del repositorio.',
      badge: 'Documentos',
    },
    {
      key: 'canManageSalesOrders',
      title: 'Órdenes de Venta & Facturación (Pestaña 7)',
      description: 'Permite crear y despachar Órdenes de Venta (OV), emitir remisiones de entrega, asignar transportadoras y radicar facturas.',
      badge: 'Ventas / OV',
    },
    {
      key: 'canManageQuotesHistory',
      title: 'Historial & Base de Datos de Cotizaciones',
      description: 'Permite crear nuevas cotizaciones (+1), cambiar estados (Borrador/Enviada/Aprobada), duplicar y eliminar del historial.',
      badge: 'Historial',
    },
    {
      key: 'canManageSuppliers',
      title: 'Directorio de Proveedores & Fabricantes',
      description: 'Permite crear nuevos proveedores, actualizar NIT, contactos comerciales, condiciones de crédito y marcas representadas.',
      badge: 'Proveedores',
    },
    {
      key: 'canManageSerials',
      title: 'Trazabilidad de Seriales, Lotes & Manifiestos DIAN',
      description: 'Permite asignar seriales físicos, placas de activo hospitalario, declaraciones aduaneras DIAN y actas de entrega.',
      badge: 'Biomédica',
    },
    {
      key: 'canManageCustomization',
      title: 'Personalización de Marca, Membrete & Temas',
      description: 'Permite configurar logotipo de la empresa, membrete institucional para cotizaciones, temas de color y tipografías.',
      badge: 'Personalización',
    },
    {
      key: 'canExportData',
      title: 'Exportación Masiva & Descarga de Fichas/ZIP',
      description: 'Permite descargar paquetes ZIP masivos de documentos técnicos, exportar bases de datos completas y reportes a Excel.',
      badge: 'Exportación',
    },
    {
      key: 'canManageBackups',
      title: 'Base de Datos Excel (.xlsx) & Centro de Respaldo',
      description: 'Permite descargar y restaurar copias de seguridad completas en Excel (.xlsx) o JSON y sincronizar respaldos en la nube.',
      badge: 'Base de Datos',
    },
    {
      key: 'canAccessSqlAnalytics',
      title: 'Consola Relacional & Analítica SQL (Admin)',
      description: 'Permite desbloquear con contraseña y ejecutar consultas SQL avanzadas sobre todas las tablas del sistema.',
      badge: 'SQL Admin',
    },
    {
      key: 'canManageGmailPurchases',
      title: 'Bandeja Inteligente Gmail Compras & IA',
      description: 'Permite gestionar correos de compras, conectar cuentas de Gmail, enviar OCs y cotizaciones a proveedores.',
      badge: 'Gmail Compras',
    },
  ];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/25 animate-fadeIn overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#111c2e] border border-[#334d6e] rounded-2xl max-w-5xl lg:max-w-6xl w-full p-4 sm:p-5 space-y-4 shadow-2xl animate-scaleUp my-auto max-h-[82vh] h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#334d6e] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#38bdf8] to-[#0284c7] text-white shadow-md shrink-0">
              {isAdmin ? <Users className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2 truncate">
                <span>
                  {isAdmin
                    ? 'Gestión de Usuarios, Rangos & Permisos'
                    : 'Mi Perfil & Seguridad de Acceso'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {isAdmin
                  ? 'Cree usuarios, configure contraseñas y asigne rangos y permisos'
                  : 'Consulte sus permisos activos y actualice su contraseña'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
              title="Cerrar ventana"
            >
              <X className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>

        {/* Inner Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
          {/* Status Alerts */}
          {successMessage && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

        {/* ========================================================================= */}
        {/* ADMIN VIEW ONLY: USER LIST CAROUSEL & "+ CREAR NUEVO USUARIO" BUTTON */}
        {/* ========================================================================= */}
        {isAdmin && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Usuarios Registrados en el Sistema ({users.length}):
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(!isCreatingNew);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition cursor-pointer ${
                  isCreatingNew
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-md shadow-emerald-500/20'
                }`}
              >
                {isCreatingNew ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Volver a la Lista</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Crear Nuevo Usuario</span>
                  </>
                )}
              </button>
            </div>

            {/* User Cards Carousel / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {users.map((u) => {
                const isSelected = !isCreatingNew && u.id === selectedUserId;
                const isUserAdmin = u.role === 'admin';

                return (
                  <div
                    key={u.id}
                    onClick={() => selectUser(u)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2.5 relative group ${
                      isSelected
                        ? 'bg-[#192b45] border-[#38bdf8] shadow-md shadow-[#38bdf8]/10 ring-1 ring-[#38bdf8]'
                        : 'bg-[#15253d]/60 border-[#334d6e] hover:bg-[#192b45] hover:border-slate-500 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white font-black text-xs shrink-0 shadow-md border border-white/10 ${
                          u.avatarPhotoUrl
                            ? 'bg-slate-900'
                            : `bg-gradient-to-br ${u.avatarColor || 'from-blue-600 to-indigo-600'}`
                        }`}
                      >
                        {u.avatarPhotoUrl ? (
                          <img
                            src={u.avatarPhotoUrl}
                            alt={u.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : u.name ? (
                          u.name.substring(0, 2).toUpperCase()
                        ) : (
                          'US'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-xs text-white font-black truncate">{u.name}</strong>
                          {isUserAdmin ? (
                            <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-black uppercase">
                              Admin
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-black uppercase">
                              {u.roleLabel?.split(' ')[0] || 'Investigador'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                          @{u.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#38bdf8] text-slate-950 flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      {isAdmin && u.id !== 'user-admin-1' && u.id !== currentUser?.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserToDeleteId(u.id);
                          }}
                          title={`Eliminar usuario ${u.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delete Confirmation Banner (Admin only) */}
        {isAdmin && userToDeleteId && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-xl space-y-2 animate-shake">
            <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>¿Está seguro de que desea eliminar permanentemente este usuario del sistema?</span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUserToDeleteId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(userToDeleteId)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Sí, Eliminar Usuario
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADMIN VIEW ONLY: USER CREATION FORM */}
        {/* ========================================================================= */}
        {isAdmin && isCreatingNew && (
          <form
            onSubmit={handleCreateUserSubmit}
            className="bg-[#15253d] p-5 rounded-2xl border border-emerald-500/40 space-y-5 shadow-xl animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-[#334d6e] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Registrar Nuevo Usuario del Sistema
                  </h3>
                  <p className="text-xs text-slate-400">
                    Defina las credenciales de acceso, rol institucional y asigne permisos específicos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#111c2e] transition"
              >
                Cancelar
              </button>
            </div>

            {/* Basic Info Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Nombre Completo / Visible *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Daniel Sánchez"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-[#38bdf8] outline-none"
                />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Nombre de Usuario (Login) *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ej: danielsanchez"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:border-[#38bdf8] outline-none"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Contraseña de Acceso *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono font-bold focus:border-[#38bdf8] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Correo Institucional (Opcional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ejemplo@syd.com.co"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white focus:border-[#38bdf8] outline-none"
                />
              </div>

              {/* Role / Rank Selector */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Rango / Rol en la Aplicación
                </label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setNewRole(r);
                    if (r === 'admin') {
                      setNewRoleLabel('Administrador Total');
                      setNewDepartment('Dirección Comercial & Costos');
                      setNewPermissions({ ...FULL_ADMIN_PERMISSIONS });
                    } else {
                      setNewRoleLabel('Investigador & Descargas');
                      setNewDepartment('Licitaciones & Consultas');
                      setNewPermissions({ ...DEFAULT_VIEWER_PERMISSIONS });
                    }
                  }}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-[#38bdf8] outline-none"
                >
                  <option value="viewer">🔍 Investigador / Consultor (Permisos Personalizables)</option>
                  <option value="admin">👑 Administrador Total (Acceso Completo Sin Restricciones)</option>
                </select>
              </div>

              {/* Department / Cargo */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Departamento / Cargo
                </label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Ej: Licitaciones & Consultas"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white focus:border-[#38bdf8] outline-none"
                />
              </div>
            </div>

            {/* Custom Permissions Setup for New User (if viewer) */}
            {newRole === 'viewer' && (
              <div className="pt-2 border-t border-[#334d6e]/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Asignar Permisos de Modificación Iniciales</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Seleccione qué módulos podrá editar este nuevo usuario.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNewPermissions({
                          canEditSales: true,
                          canEditCostManager: true,
                          canEditCatalog: true,
                          canEditTenders: true,
                          canManageOCTracking: true,
                          canEditDocuments: true,
                          canManageSalesOrders: true,
                          canManageQuotesHistory: true,
                          canManageSuppliers: true,
                          canManageSerials: true,
                          canManageCustomization: true,
                          canExportData: true,
                          canManageBackups: true,
                          canAccessSqlAnalytics: true,
                          canManageGmailPurchases: true,
                        })
                      }
                      className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded hover:bg-emerald-500/30 transition"
                    >
                      Habilitar Todo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewPermissions({
                          canEditSales: false,
                          canEditCostManager: false,
                          canEditCatalog: false,
                          canEditTenders: false,
                          canManageOCTracking: false,
                          canEditDocuments: false,
                          canManageSalesOrders: false,
                          canManageQuotesHistory: false,
                          canManageSuppliers: false,
                          canManageSerials: false,
                          canManageCustomization: false,
                          canExportData: false,
                          canManageBackups: false,
                          canAccessSqlAnalytics: false,
                          canManageGmailPurchases: false,
                        })
                      }
                      className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded hover:bg-slate-700 transition"
                    >
                      Solo Lectura
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {permissionItems.map((item) => {
                    const isEnabled = newPermissions[item.key];
                    return (
                      <label
                        key={item.key}
                        className={`p-3 rounded-xl border transition flex items-start justify-between gap-3 cursor-pointer ${
                          isEnabled
                            ? 'bg-[#192b45] border-emerald-500/50'
                            : 'bg-[#111c2e]/60 border-[#334d6e]/60'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-white block">{item.title}</span>
                          <span className="text-[10px] text-slate-400 block leading-tight">{item.description}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) =>
                            setNewPermissions({
                              ...newPermissions,
                              [item.key]: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-700 rounded focus:ring-emerald-400 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2 border-t border-[#334d6e]">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Registrar y Crear Usuario</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* VIEW FOR NON-ADMIN USER (HIJO): PERSONAL PROFILE & PASSWORD CHANGE */}
        {/* ========================================================================= */}
        {!isAdmin && selectedUser && (
          <div className="space-y-5">
            {/* User Info Badge */}
            <div className="p-4 rounded-xl bg-[#15253d] border border-[#334d6e] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-white font-black text-base shadow-md border border-white/10 ${
                    selectedUser.avatarPhotoUrl
                      ? 'bg-slate-900'
                      : `bg-gradient-to-br ${selectedUser.avatarColor || 'from-emerald-600 to-teal-600'}`
                  }`}
                >
                  {selectedUser.avatarPhotoUrl ? (
                    <img
                      src={selectedUser.avatarPhotoUrl}
                      alt={selectedUser.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : selectedUser.name ? (
                    selectedUser.name.substring(0, 2).toUpperCase()
                  ) : (
                    'HI'
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">{selectedUser.name}</h3>
                    <span className="px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase">
                      {selectedUser.roleLabel || 'Investigador & Descargas'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Usuario de Acceso: <strong className="font-mono text-[#38bdf8]">@{selectedUser.username}</strong> | Área: <span className="text-slate-300">{selectedUser.department}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Password Change Only */}
            <form onSubmit={handleSaveCredentials} className="bg-[#15253d] p-5 rounded-xl border border-[#334d6e] space-y-4">
              <div className="flex items-center justify-between border-b border-[#334d6e]/70 pb-2.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#38bdf8]" />
                  <span>Cambiar Mi Contraseña Personal</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Actualice su clave de acceso al sistema
                </span>
              </div>

              <div className="max-w-md space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Nueva Contraseña de Acceso
                </label>
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Ingrese su nueva contraseña"
                      className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono font-bold focus:border-[#38bdf8] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-md transition cursor-pointer shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Mi Clave</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Read-Only Permissions Status for Fabian */}
            <div className="bg-[#15253d] p-5 rounded-xl border border-[#334d6e] space-y-4">
              <div className="border-b border-[#334d6e]/70 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Permisos Asignados a Mi Cuenta
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  A continuación se muestran las acciones que tiene autorizadas en el sistema. Los permisos son administrados por el Administrador (<strong className="text-slate-200 font-bold">Jairo</strong>).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {permissionItems.map((item) => {
                  const isEnabled = permissions[item.key];

                  return (
                    <div
                      key={item.key}
                      className={`p-3.5 rounded-xl border transition flex items-start justify-between gap-3 ${
                        isEnabled
                          ? 'bg-[#192b45] border-emerald-500/50 shadow-sm'
                          : 'bg-[#111c2e]/70 border-[#334d6e]/60 opacity-80'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{item.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {item.description}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-black flex items-center gap-1 ${
                            isEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isEnabled ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>HABILITADO</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-slate-500" />
                              <span>SOLO LECTURA</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADMIN VIEW ONLY: EDIT SELECTED USER FORM */}
        {/* ========================================================================= */}
        {isAdmin && !isCreatingNew && selectedUser && (
          <form onSubmit={handleSaveCredentials} className="bg-[#15253d] p-5 rounded-xl border border-[#334d6e] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334d6e]/70 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-[#38bdf8]" />
                <span>
                  Modificar Datos &amp; Contraseña de:{' '}
                  <strong className="text-[#38bdf8]">{selectedUser.name}</strong>
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  Rango Actual:{' '}
                  <strong className="text-white font-bold">{selectedUser.roleLabel}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Nombre Visible
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Jairo o Fabian"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-[#38bdf8] outline-none"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Nombre de Usuario (Login)
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="Ej: Jairo o Fabian"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:border-[#38bdf8] outline-none"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Contraseña de Acceso
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono font-bold focus:border-[#38bdf8] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Role / Rank */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Rango / Rol
                </label>
                <select
                  value={formRole}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setFormRole(r);
                    if (r === 'admin') {
                      setFormRoleLabel('Administrador Total');
                      setPermissions({ ...FULL_ADMIN_PERMISSIONS });
                    } else {
                      setFormRoleLabel('Investigador & Descargas');
                      setPermissions({ ...DEFAULT_VIEWER_PERMISSIONS });
                    }
                  }}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-[#38bdf8] outline-none"
                >
                  <option value="viewer">🔍 Investigador / Consultor</option>
                  <option value="admin">👑 Administrador Total</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Etiqueta de Cargo / Rango
                </label>
                <input
                  type="text"
                  value={formRoleLabel}
                  onChange={(e) => setFormRoleLabel(e.target.value)}
                  placeholder="Ej: Investigador & Descargas"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white focus:border-[#38bdf8] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Departamento
                </label>
                <input
                  type="text"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  placeholder="Ej: Licitaciones & Consultas"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white focus:border-[#38bdf8] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-md transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Cambios de Usuario</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* ADMIN VIEW ONLY: PERMISSIONS MANAGEMENT SECTION FOR NON-ADMIN USER */}
        {/* ========================================================================= */}
        {isAdmin && !isCreatingNew && selectedUser && (
          <div className="bg-[#15253d] p-5 rounded-xl border border-[#334d6e] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#334d6e]/70 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Matriz de Permisos de Edición para:{' '}
                    <span className="text-emerald-400">{selectedUser.name}</span>{' '}
                    <span className="text-xs font-mono text-slate-400">(@{selectedUser.username})</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedUser.role === 'admin'
                    ? 'Este usuario es Administrador Total y posee acceso irrestricto a todos los módulos.'
                    : 'El Administrador puede habilitar o revocar permisos específicos de modificación para este usuario.'}
                </p>
              </div>

              {selectedUser.role !== 'admin' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetAllPermissions(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition cursor-pointer"
                  >
                    Permitir Todo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllPermissions(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition cursor-pointer"
                  >
                    Solo Lectura Total
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {permissionItems.map((item) => {
                const isEnabled = selectedUser.role === 'admin' ? true : permissions[item.key];
                const canToggle = selectedUser.role !== 'admin';

                return (
                  <div
                    key={item.key}
                    className={`p-3.5 rounded-xl border transition flex items-start justify-between gap-3 ${
                      isEnabled
                        ? 'bg-[#192b45] border-emerald-500/50 shadow-sm'
                        : 'bg-[#111c2e]/70 border-[#334d6e]/60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{item.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                            isEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {isEnabled ? 'HABILITADO' : 'BLOQUEADO'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {item.description}
                      </p>
                    </div>

                    {canToggle ? (
                      <button
                        type="button"
                        onClick={() => handleTogglePermission(item.key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    ) : (
                      <div className="p-1">
                        {isEnabled ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-[#334d6e]">
          <div className="text-xs text-slate-400">
            {isAdmin
              ? `${users.length} ${users.length === 1 ? 'cuenta activa' : 'cuentas activas'} en el sistema`
              : 'Sesión activa como Investigador'}
          </div>
          <div className="text-[11px] text-slate-500">
            Presione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">ESC</kbd> o clic en el botón superior para cerrar
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
