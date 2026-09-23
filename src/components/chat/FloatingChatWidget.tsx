import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Users,
  Send,
  MessageSquare,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  RotateCcw,
  ArrowRight,
  RefreshCw,
  Hash,
  UserCheck,
  ShieldCheck,
  CheckCheck,
  Loader2,
  PlusCircle,
  FileSpreadsheet,
  Layers,
  FileCheck2,
  Sliders,
  Printer,
  HelpCircle,
  TrendingUp,
  FolderOpen,
  Truck,
  Building2,
  Bell,
  GripHorizontal,
  Database,
} from 'lucide-react';
import { AuthUser, ActiveTab, BotChatMessage, BotActionOption, UserChatMessage, StoredUserAccount } from '../../types';
import { getStoredUsers } from '../../data/authData';
import { MaraAvatar } from '../common/MaraAvatar';
import {
  getConversationMessages,
  sendTeamChatMessage,
  markConversationAsRead,
  getUnreadMessagesCount,
  getStoredTeamMessages,
} from '../../utils/chatStorage';
import { getLiveDynamicSystemContext, getIntelligentMaraFallbackReply } from '../../utils/maraKnowledgeEngine';

interface Coordinates {
  x: number;
  y: number;
}

interface FloatingChatWidgetProps {
  currentUser: AuthUser | null;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  equipmentsCount?: number;
  quotesCount?: number;
  tenderClientsCount?: number;
  ocContractsCount?: number;
  suppliersCount?: number;
  documentsCount?: number;
  alertsCount?: number;
  onOpenEquipmentModal?: () => void;
  onOpenDocumentModal?: () => void;
  onOpenNewQuote?: () => void;
  onOpenUserManagement?: () => void;
  onOpenCustomization?: () => void;
  onOpenPrintModal?: () => void;
  onOpenSuppliersModal?: () => void;
  onOpenNewOCModal?: () => void;
  onOpenAppUpdates?: () => void;
  onOpenBackupModal?: () => void;
  onOpenWorkspaceModal?: () => void;
}

const INITIAL_BOT_MESSAGES: BotChatMessage[] = [
  {
    id: 'bot-welcome-mara',
    sender: 'bot',
    text: '¡Hola! Soy **Mara**, tu Asistente Biomédica y Copiloto Oficial en SYD Colombia (v2.7.0).\n\nEstoy sincronizada en tiempo real con toda la operación:\n• **Google Workspace & Sheets (N-FCO-03)**: Creación de equipos validados, modificaciones ágiles y bloqueo automático de partes inactivadas.\n• **Gmail Compras**: Extracción inteligente de OCs en bandeja con almacenamiento optimizado sin errores de cuota.\n• **Órdenes de Venta (OV) & Facturación**: Despachos, remisiones firmadas, radicación de facturas y cartera.\n• **Cotizador & PDF Oficial**: Ofertas comerciales con IVA, márgenes L1-L8 y membrete.\n• **Gestor de Costos & TRM**: TRM actualizada automáticamente cada 2 horas.\n• **Catálogo Biomédico & INVIMA**: Redacción con IA, registros sanitarios y accesorios.\n• **Seguimiento de OC**: Trazabilidad de 11 estados logísticos y manifiestos DIAN.\n\n¿En qué te puedo colaborar hoy?',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    actions: [
      { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
      { label: 'Órdenes de Venta (OV)', type: 'navigate', tab: 'ordenes_venta' },
      { label: 'Google Workspace (Drive / Sheets)', type: 'modal', modalAction: 'google_workspace_modal' },
      { label: 'Gmail Compras', type: 'navigate', tab: 'gmail_compras' },
      { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
      { label: 'Directorio de Proveedores', type: 'modal', modalAction: 'manage_suppliers' },
      { label: 'Gestor de Costos & TRM', type: 'navigate', tab: 'costos' },
      { label: 'Licitaciones SECOP II', type: 'navigate', tab: 'licitaciones' },
    ],
  },
];

const BOT_QUICK_PROMPTS = [
  '¿Cómo procesar partes del Formato N-FCO-03 de Google Drive?',
  '¿Cómo funciona la detección de órdenes en Gmail Compras?',
  '¿Cómo hacer una nueva cotización paso a paso?',
  '¿Cómo hacer seguimiento a las Órdenes de Compra (OC)?',
  '¿Cómo gestionar proveedores y fabricantes?',
  '¿Cómo funciona la TRM automática cada 2 horas?',
  '¿Cómo optimizar especificaciones con rangos para SECOP II?',
  '¿Cómo calcular el precio con Margen L3?',
  '¿Cómo registrar un nuevo equipo biomédico?',
  '¿Cómo cerrar ventanas con la tecla ESC?',
];

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  equipmentsCount = 0,
  quotesCount = 0,
  tenderClientsCount = 0,
  ocContractsCount = 0,
  suppliersCount = 0,
  documentsCount = 0,
  alertsCount = 0,
  onOpenEquipmentModal,
  onOpenDocumentModal,
  onOpenNewQuote,
  onOpenUserManagement,
  onOpenCustomization,
  onOpenPrintModal,
  onOpenSuppliersModal,
  onOpenNewOCModal,
  onOpenAppUpdates,
  onOpenBackupModal,
  onOpenWorkspaceModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatMode, setChatMode] = useState<'bot' | 'team'>('bot');

  // Custom persistent coordinates for smooth drag & drop
  const [customCoords, setCustomCoords] = useState<Coordinates | null>(() => {
    try {
      const saved = localStorage.getItem('syd_mara_custom_coords_v3');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialLeft: number; initialTop: number; moved: boolean } | null>(null);
  const widgetRootRef = useRef<HTMLDivElement>(null);

  // AI Bot Mara state
  const [botMessages, setBotMessages] = useState<BotChatMessage[]>(() => {
    const saved = localStorage.getItem('syd_ai_bot_chat_history_mara_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_BOT_MESSAGES;
  });
  const [botInput, setBotInput] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);

  // Team User Chat state
  const [teamMessages, setTeamMessages] = useState<UserChatMessage[]>(() => getStoredTeamMessages());
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('general');
  const [teamInput, setTeamInput] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState<StoredUserAccount[]>([]);
  const [unreadTeamCount, setUnreadTeamCount] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load system users for direct messaging
  useEffect(() => {
    const users = getStoredUsers();
    setRegisteredUsers(users);
  }, [currentUser, isOpen]);

  // Handle ESC key to close chat widget
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Ensure custom coordinates stay within viewport on resize
  useEffect(() => {
    const handleResize = () => {
      if (customCoords) {
        const curWidth = widgetRootRef.current?.offsetWidth || 56;
        const curHeight = widgetRootRef.current?.offsetHeight || 56;
        const maxX = Math.max(12, window.innerWidth - curWidth - 12);
        const maxY = Math.max(12, window.innerHeight - curHeight - 12);
        const boundedX = Math.min(Math.max(12, customCoords.x), maxX);
        const boundedY = Math.min(Math.max(12, customCoords.y), maxY);
        if (boundedX !== customCoords.x || boundedY !== customCoords.y) {
          const newCoords = { x: boundedX, y: boundedY };
          setCustomCoords(newCoords);
          localStorage.setItem('syd_mara_custom_coords_v3', JSON.stringify(newCoords));
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [customCoords]);

  // Update unread count and listen for cross-tab or local chat updates
  useEffect(() => {
    const updateChatData = () => {
      const allMsgs = getStoredTeamMessages();
      setTeamMessages(allMsgs);
      if (currentUser) {
        const count = getUnreadMessagesCount(currentUser.id);
        setUnreadTeamCount(count);
      }
    };

    updateChatData();

    const handleCustomUpdate = () => updateChatData();
    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === 'syd_team_user_chat_messages_v1') {
        updateChatData();
      }
    };

    window.addEventListener('syd-team-chat-updated', handleCustomUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener('syd-team-chat-updated', handleCustomUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [currentUser]);

  // Mark conversation as read when opening or selecting recipient
  useEffect(() => {
    if (isOpen && chatMode === 'team' && currentUser) {
      markConversationAsRead(currentUser.id, selectedRecipientId);
      setUnreadTeamCount(getUnreadMessagesCount(currentUser.id));
    }
  }, [isOpen, chatMode, selectedRecipientId, currentUser, teamMessages.length]);

  // Save bot messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('syd_ai_bot_chat_history_mara_v3', JSON.stringify(botMessages));
    } catch (e) {
      console.error(e);
    }
  }, [botMessages]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, chatMode, botMessages, teamMessages, isBotThinking]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, chatMode]);

  // Mouse / Touch Dragging implementation with complete text-selection prevention
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag on left click or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.target as HTMLElement;
    const isBubbleButton = !!target.closest('#btn-open-floating-chat');
    const isChatCardHeader = !!target.closest('#chat-card-header');

    // If inside chat window but not the header, ignore clicks on interactive buttons, inputs, etc.
    if (!isBubbleButton && !isChatCardHeader) {
      if (target.closest('button, input, textarea, a, select, [role="button"]')) {
        return;
      }
    }

    // Clear any accidental page text selection
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    const rect = widgetRootRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      moved: false,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true;
        setIsDragging(true);

        const curWidth = widgetRootRef.current?.offsetWidth || 56;
        const curHeight = widgetRootRef.current?.offsetHeight || 56;
        const maxX = Math.max(10, window.innerWidth - curWidth - 10);
        const maxY = Math.max(10, window.innerHeight - curHeight - 10);

        const newLeft = Math.min(Math.max(10, dragRef.current.initialLeft + dx), maxX);
        const newTop = Math.min(Math.max(10, dragRef.current.initialTop + dy), maxY);

        const newCoords = { x: newLeft, y: newTop };
        setCustomCoords(newCoords);
      }
    };

    const handlePointerUp = () => {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';

      if (dragRef.current?.moved && customCoords) {
        localStorage.setItem('syd_mara_custom_coords_v3', JSON.stringify(customCoords));
      }
      setTimeout(() => {
        setIsDragging(false);
        dragRef.current = null;
      }, 50);

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Action Click Handler for Mara
  const handleExecuteAction = (action: BotActionOption) => {
    if (action.type === 'navigate' || action.tab) {
      if (action.tab) {
        setActiveTab(action.tab);
      }
    } else if (action.type === 'modal' || action.modalAction) {
      switch (action.modalAction) {
        case 'new_equipment':
          onOpenEquipmentModal?.();
          break;
        case 'new_document':
          onOpenDocumentModal?.();
          break;
        case 'new_quote':
          onOpenNewQuote?.();
          break;
        case 'user_management':
          onOpenUserManagement?.();
          break;
        case 'customization':
          onOpenCustomization?.();
          break;
        case 'print_preview':
          onOpenPrintModal?.();
          break;
        case 'manage_suppliers':
          setActiveTab('seguimiento_oc');
          if (onOpenSuppliersModal) {
            onOpenSuppliersModal();
          } else {
            window.dispatchEvent(new CustomEvent('syd_open_suppliers_modal'));
          }
          break;
        case 'new_oc':
          setActiveTab('seguimiento_oc');
          if (onOpenNewOCModal) {
            onOpenNewOCModal();
          } else {
            window.dispatchEvent(new CustomEvent('syd_open_new_oc_modal'));
          }
          break;
        case 'alerts_widget':
          window.dispatchEvent(new CustomEvent('syd_open_alerts_modal'));
          break;
        case 'app_updates':
          if (onOpenAppUpdates) {
            onOpenAppUpdates();
          } else {
            window.dispatchEvent(new CustomEvent('syd_open_app_updates_modal'));
          }
          break;
        case 'backup_modal':
          if (onOpenBackupModal) {
            onOpenBackupModal();
          } else {
            window.dispatchEvent(new CustomEvent('syd_open_backup_modal'));
          }
          break;
        case 'google_workspace_modal':
          if (onOpenWorkspaceModal) {
            onOpenWorkspaceModal();
          } else {
            window.dispatchEvent(new CustomEvent('syd-open-workspace-modal'));
          }
          break;
      }
    } else if (action.type === 'query' && action.queryPrompt) {
      handleSendBotMessage(action.queryPrompt);
    }
  };

  // Helper to get action icon
  const getActionIcon = (action: BotActionOption) => {
    if (action.modalAction === 'new_equipment') return <PlusCircle className="w-3.5 h-3.5" />;
    if (action.modalAction === 'new_document') return <FileCheck2 className="w-3.5 h-3.5" />;
    if (action.modalAction === 'new_quote') return <FileSpreadsheet className="w-3.5 h-3.5" />;
    if (action.modalAction === 'user_management') return <UserCheck className="w-3.5 h-3.5" />;
    if (action.modalAction === 'customization') return <Sliders className="w-3.5 h-3.5" />;
    if (action.modalAction === 'print_preview') return <Printer className="w-3.5 h-3.5" />;
    if (action.modalAction === 'manage_suppliers') return <Building2 className="w-3.5 h-3.5" />;
    if (action.modalAction === 'new_oc') return <Truck className="w-3.5 h-3.5" />;
    if (action.modalAction === 'alerts_widget') return <Bell className="w-3.5 h-3.5" />;
    if (action.modalAction === 'app_updates') return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
    if (action.modalAction === 'backup_modal') return <Database className="w-3.5 h-3.5 text-blue-400" />;
    if (action.modalAction === 'google_workspace_modal') return <Layers className="w-3.5 h-3.5 text-emerald-400" />;
    if (action.tab === 'ventas') return <FileSpreadsheet className="w-3.5 h-3.5" />;
    if (action.tab === 'costos') return <TrendingUp className="w-3.5 h-3.5" />;
    if (action.tab === 'catalogo') return <Layers className="w-3.5 h-3.5" />;
    if (action.tab === 'licitaciones') return <FolderOpen className="w-3.5 h-3.5" />;
    if (action.tab === 'seguimiento_oc') return <Truck className="w-3.5 h-3.5" />;
    if (action.tab === 'documentacion') return <FileCheck2 className="w-3.5 h-3.5" />;
    if (action.tab === 'ordenes_venta') return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />;
    if (action.tab === 'gmail_compras') return <FolderOpen className="w-3.5 h-3.5 text-amber-400" />;
  };

  // Send AI Bot message to Mara
  const handleSendBotMessage = async (queryText?: string) => {
    const textToSend = (queryText || botInput).trim();
    if (!textToSend || isBotThinking) return;

    const userMsg: BotChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setBotMessages((prev) => [...prev, userMsg]);
    setBotInput('');
    setIsBotThinking(true);

    const dynamicContext = getLiveDynamicSystemContext(activeTab, currentUser, {
      equipmentsCount,
      quotesCount,
      tenderClientsCount,
      ocContractsCount,
      suppliersCount,
      documentsCount,
      alertsCount,
    });

    try {
      const response = await fetch('/api/gemini/chat-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: botMessages.map((m) => ({ sender: m.sender, text: m.text })),
          context: dynamicContext,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const actionsList: BotActionOption[] = Array.isArray(json.actions)
          ? json.actions
          : json.suggestedTab
            ? [{ label: json.suggestedTabLabel || `Ir a ${json.suggestedTab.toUpperCase()}`, type: 'navigate', tab: json.suggestedTab, primary: true }]
            : [];

        const botReply: BotChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: json.reply || 'He procesado tu consulta. Te he dejado opciones y botones directos a continuación para continuar:',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: actionsList,
        };
        setBotMessages((prev) => [...prev, botReply]);
      } else {
        throw new Error('Chat API response not ok');
      }
    } catch (err) {
      console.warn('Error calling Mara assistant, using intelligent local engine:', err);
      const fallbackResult = getIntelligentMaraFallbackReply(textToSend, dynamicContext);
      const fallbackReply: BotChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: fallbackResult.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: fallbackResult.actions,
      };
      setBotMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setIsBotThinking(false);
    }
  };

  // Send Team chat message
  const handleSendTeamMessage = () => {
    const textToSend = teamInput.trim();
    if (!textToSend || !currentUser) return;

    sendTeamChatMessage({
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRoleLabel: currentUser.roleLabel,
      senderAvatarColor: currentUser.avatarColor,
      recipientId: selectedRecipientId,
      text: textToSend,
    });

    setTeamInput('');
    if (currentUser) {
      markConversationAsRead(currentUser.id, selectedRecipientId);
    }
  };

  const handleClearBotHistory = () => {
    const freshMessages: BotChatMessage[] = [
      {
        id: `bot-welcome-mara-${Date.now()}`,
        sender: 'bot',
        text: `¡Hola ${currentUser?.name ? currentUser.name.split(' ')[0] : ''}! Soy **Mara**, tu Asistente Biomédica y Copiloto de Inteligencia Artificial en SYD Colombia.\n\nConversación reiniciada. Puedo ayudarte con cotizaciones, cálculo de costos y TRM, seguimiento de Órdenes de Compra (OC) y licitaciones SECOP II.\n\n¿En qué te puedo asesorar o qué acción deseas ejecutar?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
          { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
          { label: 'Registrar Equipo Médico', type: 'modal', modalAction: 'new_equipment' },
          { label: 'Gestor de Costos & TRM', type: 'navigate', tab: 'costos' },
          { label: 'Licitaciones SECOP II', type: 'navigate', tab: 'licitaciones' },
          { label: 'Subir Ficha INVIMA', type: 'modal', modalAction: 'new_document' },
        ],
      },
    ];
    setBotMessages(freshMessages);
    setBotInput('');
    setIsBotThinking(false);
    try {
      localStorage.setItem('syd_ai_bot_chat_history_mara_v3', JSON.stringify(freshMessages));
    } catch (e) {
      console.error(e);
    }
  };

  // Filter current active conversation
  const currentConversationMessages = currentUser
    ? getConversationMessages(currentUser.id, selectedRecipientId)
    : teamMessages.filter((m) => m.recipientId === 'general');

  // Other users in system (excluding current user)
  const otherUsers = registeredUsers.filter((u) => u.id !== currentUser?.id);
  const activeRecipientUser = registeredUsers.find((u) => u.id === selectedRecipientId);

  // Position calculation
  const hasCustomCoords = customCoords !== null;

  const getWidgetStyle = (): React.CSSProperties => {
    if (hasCustomCoords && customCoords) {
      return {
        position: 'fixed',
        left: `${customCoords.x}px`,
        top: `${customCoords.y}px`,
        zIndex: 50,
      };
    }
    return {};
  };

  // Determine chat card position relative to button (smart upward/downward and left/right opening)
  const isPositionTop = useMemo(() => {
    if (hasCustomCoords && customCoords) {
      return customCoords.y < window.innerHeight / 2;
    }
    return false;
  }, [hasCustomCoords, customCoords]);

  const isPositionLeft = useMemo(() => {
    if (hasCustomCoords && customCoords) {
      return customCoords.x < window.innerWidth / 2;
    }
    return false;
  }, [hasCustomCoords, customCoords]);

  return (
    <div
      ref={widgetRootRef}
      id="floating-chat-root"
      className={`${!hasCustomCoords ? 'fixed bottom-5 right-5 z-50' : ''} flex flex-col ${
        isPositionLeft ? 'items-start' : 'items-end'
      } ${isDragging ? 'select-none opacity-95 scale-[1.02] transition-none' : 'transition-all duration-200'}`}
      style={getWidgetStyle()}
    >
      {/* Expanded Floating Chat Card */}
      {isOpen && (
        <div
          className={`${isPositionTop ? 'mt-3 order-2' : 'mb-3 order-1'} flex flex-col bg-[#0d1626] border border-[#2a4365] shadow-2xl rounded-2xl overflow-hidden transition-all duration-200 animate-fadeIn ${
            isExpanded
              ? 'w-[94vw] sm:w-[650px] h-[85vh] max-h-[780px]'
              : 'w-[92vw] sm:w-[450px] h-[570px]'
          }`}
          style={{ boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(56, 189, 248, 0.2)' }}
        >
          {/* Header Bar - Draggable across entire top area */}
          <div
            onPointerDown={handlePointerDown}
            className="bg-[#111c2e] border-b border-[#243b5a] p-3 flex items-center justify-between gap-2 select-none cursor-grab active:cursor-grabbing hover:bg-[#132238] transition"
            title="Arrastra desde aquí para mover la ventana de Mara"
          >
            {/* Left: Drag Grip & Tab Mode Buttons */}
            <div className="flex items-center gap-2">
              <div className="text-slate-500 hover:text-sky-400 p-0.5 cursor-grab">
                <GripHorizontal className="w-4 h-4" />
              </div>

              <div className="flex items-center bg-[#0a111c] p-1 rounded-xl border border-[#1e3450]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatMode('bot');
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    chatMode === 'bot'
                      ? 'bg-linear-to-r from-sky-400 to-indigo-400 text-slate-950 shadow-md shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MaraAvatar size="xs" showOnlineBadge={true} />
                  <span>Mara IA</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatMode('team');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer relative ${
                    chatMode === 'team'
                      ? 'bg-linear-to-r from-sky-400 to-indigo-400 text-slate-950 shadow-md shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Equipo SYD</span>
                  {unreadTeamCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs">
                      {unreadTeamCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Window Controls */}
            <div className="flex items-center gap-1">
              {chatMode === 'bot' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearBotHistory();
                  }}
                  title="Limpiar conversación con Mara"
                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-[#1a2b42] rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                title={isExpanded ? 'Reducir tamaño' : 'Maximizar ventana'}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a2b42] rounded-lg transition cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                title="Cerrar chat"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#1a2b42] rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MODE 1: MARA IA ASISTENTE CON OPCIONES Y BOTONES DE ACCIÓN */}
          {chatMode === 'bot' && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-radial from-[#132238] to-[#0a111c]">
              {/* Mara Subheader */}
              <div className="bg-[#111e33]/95 border-b border-[#243b5a] px-3.5 py-2.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2.5">
                  <MaraAvatar size="lg" showOnlineBadge={true} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold leading-tight text-xs">Mara</span>
                      <span className="text-[9px] bg-linear-to-r from-sky-500/20 to-indigo-500/20 text-sky-300 font-semibold px-1.5 py-0.2 rounded-full border border-sky-400/40">
                        Copiloto Biomédica IA
                      </span>
                    </div>
                    <span className="text-[9.5px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                      <span>Respuesta ultrarrápida • Conectada a SYD</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="text-[10px] text-slate-400 bg-[#0d1726] px-2.5 py-1 rounded-lg border border-[#233852]">
                    Ventana: <strong className="text-sky-300 capitalize">{activeTab}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearBotHistory}
                    title="Reiniciar y limpiar conversación con Mara"
                    className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-300 bg-[#0d1726] hover:bg-[#1a2b42] px-2 py-1 rounded-lg border border-[#233852] hover:border-amber-500/40 transition cursor-pointer font-medium"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpiar</span>
                  </button>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin text-xs">
                {botMessages.map((msg) => {
                  const combinedActions = msg.actions || (msg.suggestedAction ? [msg.suggestedAction] : []);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-start gap-2.5 max-w-[92%]">
                        {msg.sender === 'bot' && (
                          <MaraAvatar size="sm" showOnlineBadge={false} className="mt-0.5" />
                        )}

                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-linear-to-r from-sky-500 to-blue-600 text-white rounded-tr-xs shadow-md shadow-sky-500/10'
                              : 'bg-[#15243b] text-slate-200 border border-[#2c476f] rounded-tl-xs shadow-md'
                          }`}
                        >
                          <div className="whitespace-pre-wrap select-text">{msg.text}</div>

                          {/* Direct Action Buttons rendered under Mara's advice */}
                          {combinedActions.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-[#31507a]/70 flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider">
                                Acciones directas recomendadas:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {combinedActions.map((act, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleExecuteAction(act)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer active:scale-95 shadow-sm ${
                                      act.primary
                                        ? 'bg-linear-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-slate-950 shadow-sky-500/20 font-black'
                                        : 'bg-[#1c3252] hover:bg-[#284775] text-sky-200 border border-[#3b5e8c]'
                                    }`}
                                  >
                                    {getActionIcon(act)}
                                    <span>{act.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[9.5px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  );
                })}

                {isBotThinking && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-1 animate-pulse">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <span className="text-sky-300 font-medium">Mara está analizando y preparando las mejores opciones...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts Bar */}
              <div className="px-3 pt-2 pb-1.5 border-t border-[#20344d] bg-[#0c1422]/90 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-[10px] text-slate-400 font-bold shrink-0">Preguntar a Mara:</span>
                {BOT_QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendBotMessage(prompt)}
                    className="shrink-0 text-[10.5px] bg-[#162740] hover:bg-[#233d64] text-slate-300 hover:text-sky-200 border border-[#2e476b] px-2.5 py-1 rounded-full transition cursor-pointer whitespace-nowrap"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendBotMessage();
                }}
                className="p-3 bg-[#0f1a2e] border-t border-[#20344d] flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Escribe a Mara sobre cualquier acción, equipo o cálculo..."
                  value={botInput}
                  onChange={(e) => setBotInput(e.target.value)}
                  className="flex-1 bg-[#14233a] border border-[#2d4972] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none"
                />
                <button
                  type="submit"
                  disabled={!botInput.trim() || isBotThinking}
                  className="bg-linear-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 disabled:opacity-40 text-slate-950 p-2 rounded-xl font-bold transition cursor-pointer shadow-md shadow-sky-500/20 active:scale-95"
                  title="Enviar consulta a Mara"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* MODE 2: CHAT DE EQUIPO / USUARIOS */}
          {chatMode === 'team' && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-radial from-[#132238] to-[#0a111c]">
              {/* Recipient & Channel Selector Subheader */}
              <div className="bg-[#111e33] border-b border-[#243b5a] p-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {/* General Channel */}
                <button
                  type="button"
                  onClick={() => setSelectedRecipientId('general')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                    selectedRecipientId === 'general'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-[#15253d] text-slate-300 hover:text-white border border-[#2e476b]'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>General</span>
                  {getUnreadMessagesCount(currentUser?.id || '', 'general') > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" />
                  )}
                </button>

                {/* Direct user channels */}
                {otherUsers.map((user) => {
                  const unread = getUnreadMessagesCount(currentUser?.id || '', user.id);
                  const isSelected = selectedRecipientId === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedRecipientId(user.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-sky-400 text-slate-950 shadow-md'
                          : 'bg-[#15253d] text-slate-300 hover:text-white border border-[#2e476b]'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-linear-to-tr ${user.avatarColor || 'from-blue-600 to-indigo-600'} flex items-center justify-center text-[9px] text-white font-bold`}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                      {unread > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1 rounded-full">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Conversation Banner */}
              <div className="bg-[#0e192a] px-3.5 py-1.5 border-b border-[#20344d] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Conversando en:</span>
                  {selectedRecipientId === 'general' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5" />
                      <span>Canal Público de Todo el Equipo</span>
                    </span>
                  ) : (
                    <span className="text-sky-300 font-bold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>
                        {activeRecipientUser?.name} ({activeRecipientUser?.roleLabel})
                      </span>
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-slate-400">
                  Tú: <strong className="text-slate-200">{currentUser?.name || 'Invitado'}</strong>
                </span>
              </div>

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin text-xs">
                {currentConversationMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-600" />
                    <p className="font-medium text-xs">No hay mensajes previos en esta conversación.</p>
                    <p className="text-[11px] text-slate-500">
                      ¡Envía un mensaje para iniciar la comunicación con tu equipo!
                    </p>
                  </div>
                ) : (
                  currentConversationMessages.map((msg) => {
                    const isOwn = msg.senderId === currentUser?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-start gap-2 max-w-[88%]">
                          {!isOwn && (
                            <div
                              className={`w-6 h-6 rounded-full bg-linear-to-tr ${msg.senderAvatarColor || 'from-emerald-600 to-teal-600'} flex items-center justify-center shrink-0 text-white font-bold text-[10px] shadow-sm mt-0.5`}
                            >
                              {msg.senderName.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed ${
                              isOwn
                                ? 'bg-linear-to-r from-sky-600 to-blue-700 text-white rounded-tr-xs shadow-md shadow-sky-600/10'
                                : 'bg-[#15243b] text-slate-200 border border-[#2c476f] rounded-tl-xs shadow-md'
                            }`}
                          >
                            {!isOwn && (
                              <div className="flex items-center justify-between gap-2 border-b border-[#2d4973]/60 pb-1 mb-1.5 text-[10px]">
                                <strong className="text-sky-300 font-bold">{msg.senderName}</strong>
                                <span className="text-slate-400 text-[9.5px]">{msg.senderRoleLabel}</span>
                              </div>
                            )}

                            <div className="whitespace-pre-wrap select-text">{msg.text}</div>
                          </div>
                        </div>
                        <span className="text-[9.5px] text-slate-500 mt-1 px-1 flex items-center gap-1">
                          <span>{msg.timestamp}</span>
                          {isOwn && <CheckCheck className="w-3 h-3 text-sky-400" />}
                        </span>
                      </div>
                    );
                  })
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Team Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendTeamMessage();
                }}
                className="p-3 bg-[#0f1a2e] border-t border-[#20344d] flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder={
                    selectedRecipientId === 'general'
                      ? 'Mensaje para todo el equipo SYD...'
                      : `Mensaje directo para ${activeRecipientUser?.name || 'usuario'}...`
                  }
                  value={teamInput}
                  onChange={(e) => setTeamInput(e.target.value)}
                  className="flex-1 bg-[#14233a] border border-[#2d4972] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none"
                />
                <button
                  type="submit"
                  disabled={!teamInput.trim()}
                  className="bg-[#38bdf8] hover:bg-[#22aae6] disabled:opacity-40 text-slate-950 p-2 rounded-xl font-bold transition cursor-pointer shadow-md shadow-sky-500/20 active:scale-95"
                  title="Enviar mensaje"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button (Compact Circular Logo Bubble - Freely Draggable) */}
      <div
        className={`${isPositionTop ? 'order-1' : 'order-2'} relative flex items-center select-none`}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
      >
        <button
          id="btn-open-floating-chat"
          type="button"
          draggable={false}
          onPointerDown={handlePointerDown}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDragging && !dragRef.current?.moved) {
              setIsOpen(!isOpen);
            }
          }}
          className="relative group p-1 rounded-full bg-linear-to-tr from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] shadow-2xl transition-transform duration-200 hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing border-2 border-sky-300/60 touch-none select-none overflow-hidden"
          style={{
            borderRadius: '9999px',
            boxShadow: '0 8px 25px rgba(14, 165, 233, 0.5), 0 0 20px rgba(56, 189, 248, 0.4)',
            touchAction: 'none',
          }}
          title={isOpen ? 'Cerrar asistente Mara' : 'Mara IA - Arrastra libremente para mover o clic para abrir'}
        >
          {/* Circular Mara Avatar Logo */}
          <div className="relative pointer-events-none select-none rounded-full overflow-hidden" draggable={false}>
            <MaraAvatar size="md" showOnlineBadge={true} />
          </div>

          {/* Unread badge */}
          {unreadTeamCount > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0f172a] shadow-lg animate-bounce pointer-events-none">
              {unreadTeamCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};


