import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, AlertCircle } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { PapelRasgadoFlower } from './PapelRasgadoFlower';
import { PapelRasgadoRsvpForm } from './rsvp/PapelRasgadoRsvpForm';
import { PapelRasgadoRsvpSuccess } from './rsvp/PapelRasgadoRsvpSuccess';
import { useModal } from '../../hooks/useModal';
import { useRsvp } from '../../hooks/useRsvp';
import {
  DEFAULT_MENU_OPTIONS,
  DEFAULT_MENU_VALUE,
  demoRsvpAdapter,
} from '../../data/rsvpDefaults';
import { PAPEL_RASGADO_RSVP_CONFIG } from '../../data/templates/papelRasgadoData';
import type {
  MenuOption,
  RsvpAdapter,
  RsvpEventConfig,
  RsvpFeatureFlags,
  TipoMenu,
} from '../../types/rsvp';

export interface PapelRasgadoRsvpProps {
  className?: string;
  title?: string;
  subtitle?: string;
  message?: string;
  clickPhrase?: string;
  imageSrc?: string;
  imageAlt?: string;
  showFlower?: boolean;
  flowerVariant?: 'left' | 'right' | 'gentle';
  eventConfig?: RsvpEventConfig;
  menuOptions?: MenuOption[];
  defaultMenu?: TipoMenu;
  features?: Partial<RsvpFeatureFlags>;
  adapter?: RsvpAdapter;
  defaultGuestName?: string;
  defaultMaxPasses?: number;
}

export function PapelRasgadoRsvp({
  className = '',
  title = 'Confirmación de Asistencia',
  subtitle = 'R. S. V. P.',
  message,
  clickPhrase = '(Toca el sobre para confirmar tu asistencia)',
  imageSrc = '/images/sobre.png',
  imageAlt = 'Sobre de confirmación de asistencia (R.S.V.P.)',
  showFlower = true,
  flowerVariant = 'left',
  eventConfig = PAPEL_RASGADO_RSVP_CONFIG,
  menuOptions = DEFAULT_MENU_OPTIONS,
  defaultMenu = DEFAULT_MENU_VALUE,
  features,
  adapter = demoRsvpAdapter,
  defaultGuestName,
  defaultMaxPasses,
}: PapelRasgadoRsvpProps) {
  const {
    isOpen,
    mounted,
    open: openModal,
    close: closeModal,
    focusDialog,
    dialogRef,
  } = useModal();

  const {
    guest,
    eventConfig: effectiveEventConfig,
    features: resolvedFeatures,
    stepNumbers,
    salutationText,
    googleCalendarUrl,
    whatsAppUrl,
    handleDownloadIcs,
    isLoading,
    loadError,
    isDeadlinePassed,
    deadlineExpiredMessage,
    formValues,
    menuCounts,
    assignedMenusCount,
    remainingMenusCount,
    isSubmitted,
    isSubmitting,
    validationError,
    submitError,
    canIncrementMenuOption,
    setAttendance,
    decrementAttendees,
    incrementAttendees,
    selectMenuForSingleAttendee,
    incrementMenu,
    decrementMenu,
    updateTextField,
    handleSubmit,
    resetSubmission,
  } = useRsvp({
    eventConfig,
    menuOptions,
    defaultMenu,
    features,
    adapter,
    defaultGuestName,
    defaultMaxPasses,
  });

  // Retener foco dentro del diálogo cuando cambia la vista interna (formulario <-> éxito / carga)
  const prevViewKeyRef = useRef<string | null>(null);
  const currentViewKey = `${isLoading}-${Boolean(loadError)}-${isSubmitted}`;
  useEffect(() => {
    if (!isOpen) {
      prevViewKeyRef.current = currentViewKey;
      return;
    }
    if (
      prevViewKeyRef.current !== null &&
      prevViewKeyRef.current !== currentViewKey
    ) {
      focusDialog();
    }
    prevViewKeyRef.current = currentViewKey;
  }, [isOpen, currentViewKey, focusDialog]);

  const resolvedMessage =
    message ??
    `Será un verdadero honor contar con tu presencia. Por favor, confírmanos tu asistencia antes del ${effectiveEventConfig.rsvpDeadlineShort}:`;

  const envelopeActionLabel = isDeadlinePassed
    ? isSubmitted
      ? 'Ver confirmación de asistencia (plazo finalizado)'
      : 'Ver invitación (plazo de confirmación finalizado)'
    : isSubmitted
    ? 'Ver o modificar confirmación de asistencia'
    : clickPhrase;

  return (
    <div
      className={`w-full bg-[#EBDDCE] px-4 py-8 sm:py-12 text-[#2F2420] relative z-30 transition-colors duration-500 ${className}`}
    >
      {/* Animación fluida lenta de flotación de arriba a abajo idéntica a la sección regalo */}
      <style>{`
        @keyframes floatRsvpSlow {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .animate-float-slow-rsvp {
          animation: floatRsvpSlow 3.2s ease-in-out infinite;
          will-change: transform;
        }
      `}</style>

      {/* Flor botánica de contraste colocada sobre todo el divisor, subida para no tapar ninguna letra */}
      {showFlower && (
        <PapelRasgadoFlower
          variant={flowerVariant}
          className="absolute -top-14 sm:-top-18 left-1 sm:left-2 w-16 sm:w-20 md:w-22 z-40 drop-shadow-[0_8px_18px_rgba(60,25,12,0.25)]"
          delayMs={150}
        />
      )}

      <ScrollReveal className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center">
        {/* ENCABEZADO DE LA SECCIÓN */}
        <div className="flex flex-col items-center text-center mb-6">
          <h2
            className="font-script text-4xl sm:text-5xl text-[#B87A4A] font-normal leading-tight tracking-wide"
            style={{ fontFamily: "'Great Vibes', cursive" }}
          >
            {title}
          </h2>

          {/* Separador ornamental delicado */}
          <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#DFCBB5] to-transparent mt-2" />
        </div>

        {/* CONTENIDO DE LA SECCIÓN (DIRECTO SOBRE EL FONDO) */}
        <div className="relative w-full flex flex-col items-center text-center">
          {/* Mensaje breve */}
          <p className="text-xs sm:text-sm text-[#7D5F48] leading-relaxed max-w-xs sm:max-w-sm mb-5">
            {isSubmitted
              ? isDeadlinePassed
                ? '¡Gracias por responder! Ya hemos registrado tu confirmación. Puedes tocar el sobre para revisar los detalles:'
                : '¡Gracias por responder! Ya hemos registrado tu confirmación. Puedes tocar el sobre para revisar los detalles o realizar modificaciones:'
              : isDeadlinePassed
              ? `${deadlineExpiredMessage}. Puedes tocar el sobre para ver los detalles de la invitación:`
              : resolvedMessage}
          </p>

          {/* ZONA INTERACTIVA DEL SOBRE */}
          <div
            onClick={openModal}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openModal();
              }
            }}
            className="group cursor-pointer select-none w-full max-w-[280px] sm:max-w-[300px] flex flex-col items-center p-2 rounded-2xl transition-transform duration-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#B87A4A]/40"
            title={envelopeActionLabel}
            aria-label={envelopeActionLabel}
          >
            {/* Contenedor animado que se mueve lentamente de arriba a abajo */}
            <div className="animate-float-slow-rsvp flex flex-col items-center">
              {/* Imagen del sobre directamente sobre el fondo de la sección */}
              <div className="relative flex justify-center items-center">
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="relative z-10 w-[150px] h-[150px] object-contain drop-shadow-[0_6px_16px_rgba(70,45,25,0.18)] pointer-events-none"
                  loading="lazy"
                />

                {/* Insignia visual cuando ya respondió */}
                {isSubmitted && (
                  <div
                    className="absolute -top-1.5 -right-1.5 z-20 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md animate-in zoom-in-75 duration-300"
                    title="Asistencia confirmada"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                  </div>
                )}
              </div>

              {/* Frase animada para que clickeen, moviéndose junto al sobre */}
              <p className="mt-2.5 text-xs sm:text-[13px] font-medium text-[#8C5E35] group-hover:text-[#6D421F] transition-colors duration-300 tracking-wide text-center">
                {isSubmitted
                  ? '(¡Respuesta enviada! Toca para verla)'
                  : isDeadlinePassed
                  ? '(Plazo cerrado — Toca para revisar)'
                  : clickPhrase}
              </p>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* RECUADRO DESPLEGABLE CON PORTAL A DOCUMENT.BODY */}
      {isOpen && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm transition-opacity duration-300"
              onClick={closeModal}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="rsvp-modal-title"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[380px] sm:max-w-[430px] max-h-[90dvh] overflow-y-auto bg-[#FAF3EB] border-2 border-[#CDB8A3] rounded-2xl p-5 sm:p-7 shadow-[0_25px_60px_rgba(30,15,5,0.45)] flex flex-col text-left animate-in fade-in zoom-in-95 duration-200 focus:outline-none focus:ring-2 focus:ring-[#B8864E]/50"
              >
                {/* Filete interior sutil tipo papelería de alta gama con bordes definidos */}
                <div className="absolute inset-2 sm:inset-2.5 border-2 border-[#E0D2C2] rounded-xl pointer-events-none" />

                {/* Botón cerrar X en la esquina superior derecha */}
                <button
                  type="button"
                  onClick={closeModal}
                  className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white border-2 border-[#CDB8A3] flex items-center justify-center text-[#8C6947] hover:text-[#2F2420] transition-colors shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B8864E]"
                  aria-label="Cerrar confirmación de asistencia"
                >
                  <X className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                </button>

                {/* Contenido del Modal: Carga, Error, Formulario o Éxito */}
                <div className="relative z-10 w-full pt-1">
                  {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                      <Loader2
                        className="w-6 h-6 text-[#B8864E] animate-spin"
                        aria-hidden="true"
                      />
                      <p
                        id="rsvp-modal-title"
                        className="text-xs sm:text-sm text-[#7D5F48]"
                      >
                        Cargando datos de tu invitación...
                      </p>
                    </div>
                  ) : loadError ? (
                    <div
                      role="alert"
                      className="py-8 flex flex-col items-center text-center space-y-3"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#FAF3E8] border border-[#DFCBB5] flex items-center justify-center text-[#A04E32]">
                        <AlertCircle className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <h3
                        id="rsvp-modal-title"
                        className="font-serif text-xl text-[#2F2420]"
                        style={{
                          fontFamily: "'Cormorant Garamond', Georgia, serif",
                        }}
                      >
                        No pudimos abrir tu invitación
                      </h3>
                      <p className="text-xs sm:text-sm text-[#6E5542] max-w-xs leading-relaxed">
                        {loadError}
                      </p>
                    </div>
                  ) : !isSubmitted ? (
                    <PapelRasgadoRsvpForm
                      subtitle={subtitle}
                      salutationText={salutationText}
                      maxPasses={guest.maxPasses}
                      menuOptions={menuOptions}
                      rsvpDeadlineDisplay={
                        effectiveEventConfig.rsvpDeadlineDisplay
                      }
                      features={resolvedFeatures}
                      stepNumbers={stepNumbers}
                      formValues={formValues}
                      menuCounts={menuCounts}
                      assignedMenusCount={assignedMenusCount}
                      remainingMenusCount={remainingMenusCount}
                      isSubmitting={isSubmitting}
                      isDeadlinePassed={isDeadlinePassed}
                      deadlineExpiredMessage={deadlineExpiredMessage}
                      validationError={validationError}
                      submitError={submitError}
                      canIncrementMenuOption={canIncrementMenuOption}
                      onSetAttendance={setAttendance}
                      onDecrementAttendees={decrementAttendees}
                      onIncrementAttendees={incrementAttendees}
                      onSelectSingleMenu={selectMenuForSingleAttendee}
                      onIncrementMenu={incrementMenu}
                      onDecrementMenu={decrementMenu}
                      onUpdateTextField={updateTextField}
                      onSubmit={handleSubmit}
                    />
                  ) : (
                    <PapelRasgadoRsvpSuccess
                      guestName={guest.guestName}
                      formValues={formValues}
                      eventConfig={effectiveEventConfig}
                      features={resolvedFeatures}
                      isDeadlinePassed={isDeadlinePassed}
                      deadlineExpiredMessage={deadlineExpiredMessage}
                      googleCalendarUrl={googleCalendarUrl}
                      whatsAppUrl={whatsAppUrl}
                      onDownloadIcs={handleDownloadIcs}
                      onReset={resetSubmission}
                    />
                  )}
                </div>

                {/* Botón secundario para cerrar */}
                <button
                  type="button"
                  onClick={closeModal}
                  className="relative z-10 mt-5 mx-auto text-xs font-bold text-[#8C6947] hover:text-[#2F2420] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B8864E]/50 rounded px-2 py-0.5"
                >
                  Cerrar
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export const BeachRsvp = PapelRasgadoRsvp;
export type { PapelRasgadoRsvpProps as BeachRsvpProps };
