import type { Database } from "@vez/supabase/types";

export type OperationAppointmentStatus =
  Database["public"]["Enums"]["appointment_status"];
export type OperationQueueStatus = Database["public"]["Enums"]["queue_status"];
export type OperationQueueSource = Database["public"]["Enums"]["queue_source"];

export type OperationAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: OperationAppointmentStatus;
  priceCents: number;
  depositCents: number;
  notes: string | null;
  cancellationReason: string | null;
  customerId: string | null;
  professionalId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string | null;
  hasAccount: boolean;
  serviceName: string;
  serviceMinutes: number;
  professionalName: string;
};

export type OperationProfessional = {
  id: string;
  name: string;
  serviceIds: string[];
};

export type OperationService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  professionalIds: string[];
};

export type OperationQueueEntry = {
  id: string;
  position: number;
  status: OperationQueueStatus;
  source: OperationQueueSource;
  customerName: string;
  customerPhone: string | null;
  customerId: string | null;
  hasAccount: boolean;
  serviceId: string | null;
  serviceName: string | null;
  serviceMinutes: number | null;
  joinedAt: string;
  calledAt: string | null;
  servedAt: string | null;
  arrivedAt: string | null;
  estimatedWaitMinutes: number;
};

export type OperationCustomer = {
  key: string;
  customerId: string | null;
  name: string;
  phone: string | null;
  hasAccount: boolean;
  appointments: number;
  completed: number;
  noShows: number;
  queueVisits: number;
  spentCents: number;
  lastSeenAt: string;
};

export type PortalOperationData = {
  summary: {
    localDay: string;
    timezone: string;
    bookingMode: Database["public"]["Enums"]["booking_mode"];
    scheduledToday: number;
    confirmedToday: number;
    completedToday: number;
    revenueTodayCents: number;
    pendingApproval: number;
    queueActive: number;
    noShow30: number;
    finalized30: number;
  };
  appointments: OperationAppointment[];
  professionals: OperationProfessional[];
  services: OperationService[];
  queue: OperationQueueEntry[];
  customers: OperationCustomer[];
  queueRequireArrival: boolean;
};

export type AvailableSlot = {
  professionalId: string;
  startsAt: string;
  endsAt: string;
};

export type GuestAppointmentInput = {
  establishmentId: string;
  professionalId: string;
  serviceId: string;
  startsAt: string;
  guestName: string;
  guestPhone: string | null;
  notes: string | null;
};

export type WalkInInput = {
  establishmentId: string;
  name: string;
  phone: string | null;
  serviceId: string | null;
};

export type PortalOperationActions = {
  availableSlots: (input: {
    establishmentId: string;
    serviceId: string;
    date: string;
    professionalId: string | null;
  }) => Promise<AvailableSlot[]>;
  createGuestAppointment: (input: GuestAppointmentInput) => Promise<string>;
  approveAppointment: (id: string) => Promise<void>;
  refuseAppointment: (id: string, reason: string) => Promise<void>;
  completeAppointment: (id: string) => Promise<void>;
  markAppointmentNoShow: (id: string) => Promise<void>;
  rescheduleAppointment: (
    establishmentId: string,
    appointmentId: string,
    startsAt: string,
  ) => Promise<void>;
  callQueueEntry: (id: string) => Promise<void>;
  seatQueueEntry: (id: string) => Promise<void>;
  finishQueueEntry: (id: string) => Promise<void>;
  markQueueEntryAbsent: (id: string) => Promise<void>;
  confirmQueueArrival: (id: string) => Promise<void>;
  addWalkIn: (input: WalkInInput) => Promise<void>;
  reorderQueueEntry: (
    establishmentId: string,
    entryId: string,
    beforeId: string,
  ) => Promise<void>;
};
