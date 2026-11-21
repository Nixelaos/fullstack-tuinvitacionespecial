import React, { useRef } from 'react';
import {
  Sparkles,
  Heart,
  Check,
  Utensils,
  Music,
  Clock,
  Users,
  Send,
  Minus,
  Plus,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { GuestStepper } from '../../common/GuestStepper';
import { RSVP_FIELD_LIMITS } from '../../../data/rsvpDefaults';
import type {
  AttendanceStatus,
  MenuOption,
  MenuSelectionCounts,
  RsvpFeatureFlags,
  RsvpFormValues,
  RsvpStepNumbers,
  TipoMenu,
} from '../../../types/rsvp';

export interface PapelRasgadoRsvpFormProps {
  subtitle?: string;
  salutationText: string;
  maxPasses: number;
  menuOptions: MenuOption[];
  rsvpDeadlineDisplay: string;
  features: RsvpFeatureFlags;
  stepNumbers: RsvpStepNumbers;
  formValues: RsvpFormValues;
  menuCounts: MenuSelectionCounts;
  assignedMenusCount: number;
  remainingMenusCount: number;
  isSubmitting: boolean;
  isDeadlinePassed: boolean;
  deadlineExpiredMessage: string;
  validationError: string | null;
  submitError: string | null;
  canIncrementMenuOption: (menu: TipoMenu) => boolean;
  onSetAttendance: (status: AttendanceStatus) => void;
  onDecrementAttendees: () => void;
  onIncrementAttendees: () => void;
  onSelectSingleMenu: (menu: TipoMenu) => void;
  onIncrementMenu: (menu: TipoMenu) => void;
  onDecrementMenu: (menu: TipoMenu) => void;
  onUpdateTextField: (
    field: 'allergies' | 'song' | 'dedication',
    value: string
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['yes', 'no'];

export function PapelRasgadoRsvpForm({
  subtitle = 'R. S. V. P.',
  salutationText,
  maxPasses,
  menuOptions,
  rsvpDeadlineDisplay,
  features,
  stepNumbers,
  formValues,
  menuCounts,
  assignedMenusCount,
  remainingMenusCount,
  isSubmitting,
  isDeadlinePassed,
  deadlineExpiredMessage,
  validationError,
  submitError,
  canIncrementMenuOption,
  onSetAttendance,
  onDecrementAttendees,
  onIncrementAttendees,
  onSelectSingleMenu,
  onIncrementMenu,
  onDecrementMenu,
  onUpdateTextField,
  onSubmit,
}: PapelRasgadoRsvpFormProps) {
  const { attendance, attendeesCount, selectedMenus, allergies, song, dedication } =
    formValues;

  const attendanceRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const singleMenuRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isSingleAttendee = attendeesCount === 1;
  const activeError = validationError || submitError;

  function handleAttendanceKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    if (isDeadlinePassed) return;
    let nextIndex: number | null = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % ATTENDANCE_OPTIONS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex =
        (currentIndex - 1 + ATTENDANCE_OPTIONS.length) %
        ATTENDANCE_OPTIONS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = ATTENDANCE_OPTIONS.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      onSetAttendance(ATTENDANCE_OPTIONS[nextIndex]);
      attendanceRefs.current[nextIndex]?.focus();
    }
  }

  function handleSingleMenuKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    if (isDeadlinePassed || menuOptions.length === 0) return;
    let nextIndex: number | null = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % menuOptions.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + menuOptions.length) % menuOptions.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = menuOptions.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      onSelectSingleMenu(menuOptions[nextIndex].value);
      singleMenuRefs.current[nextIndex]?.focus();
    }
  }

  const selectedSingleMenuIndex = Math.max(
    0,
    menuOptions.findIndex((m) => m.value === selectedMenus[0])
  );

  return (
    <form onSubmit={onSubmit} className="relative z-10 space-y-6">
      {/* MÓDULO 1: ENCABEZADO Y SALUDO PERSONALIZADO */}
      <div className="text-center space-y-2.5">
        <span className="inline-block text-[11px] font-semibold tracking-[0.25em] text-[#916E49] uppercase">
          {subtitle}
        </span>

        <h2
          id="rsvp-modal-title"
          className="font-serif text-2xl sm:text-3xl text-[#2F2420] font-normal tracking-wide leading-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Confirmación de Asistencia
        </h2>

        <p className="font-serif italic text-sm sm:text-base text-[#6E5542] leading-relaxed max-w-xs mx-auto">
          «{salutationText}»
        </p>

        {/* Insignia de pases asignados (condicionada a showPassCount) */}
        {features.showPassCount && (
          <div className="pt-1.5 flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5ECE0]/80 border border-[#DFCBB5] text-[10px] sm:text-xs font-medium text-[#7D5A38] tracking-wider uppercase">
              <Users className="w-3.5 h-3.5 text-[#B8864E]" aria-hidden="true" />
              <span>
                Pases reservados en su honor:{' '}
                <strong className="text-[#2F2420] font-bold">
                  {maxPasses} {maxPasses === 1 ? 'persona' : 'personas'}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* AVISO BR-03: PLAZO VENCIDO (MODO SOLO LECTURA) */}
      {isDeadlinePassed && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl bg-[#F5ECE0] border border-[#CDB8A3] px-3.5 py-3 text-left text-xs text-[#543F30]"
        >
          <Lock
            className="w-4 h-4 text-[#B87A4A] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="leading-relaxed font-medium">
            {deadlineExpiredMessage}.
          </p>
        </div>
      )}

      {/* LÍNEA DIVISORIA ORGÁNICA */}
      <div className="flex items-center justify-center gap-2 py-1">
        <span className="w-8 h-[1px] bg-[#DFCBB5]" />
        <Sparkles className="w-3 h-3 text-[#B8864E]" aria-hidden="true" />
        <span className="w-8 h-[1px] bg-[#DFCBB5]" />
      </div>

      {/* MÓDULO 2: DECISIÓN PRINCIPAL (BIFURCACIÓN SÍ / NO) */}
      <div className="space-y-2.5">
        <span
          id="rsvp-attendance-label"
          className="block text-[11px] font-semibold tracking-[0.18em] text-[#8C6947] uppercase text-center sm:text-left"
        >
          {stepNumbers.attendance}. ¿Nos acompañas?
        </span>

        <div
          role="radiogroup"
          aria-labelledby="rsvp-attendance-label"
          className="grid grid-cols-2 gap-2.5"
        >
          {/* Opción SÍ */}
          <button
            ref={(el) => {
              attendanceRefs.current[0] = el;
            }}
            type="button"
            role="radio"
            aria-checked={attendance === 'yes'}
            tabIndex={attendance === 'yes' ? 0 : -1}
            disabled={isDeadlinePassed}
            onClick={() => onSetAttendance('yes')}
            onKeyDown={(e) => handleAttendanceKeyDown(e, 0)}
            className={`relative p-3.5 rounded-xl border text-center transition-all duration-300 flex flex-col items-center justify-center gap-1 select-none focus:outline-none focus:ring-2 focus:ring-[#B8864E]/60 ${
              isDeadlinePassed ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
            } ${
              attendance === 'yes'
                ? 'bg-[#FAF3E8] border-[#B8864E] shadow-[0_3px_12px_rgba(184,134,78,0.22)] ring-1 ring-[#B8864E]'
                : 'bg-white/70 border-[#DFCBB5] hover:bg-white hover:border-[#C8AD90] opacity-80'
            }`}
          >
            <span className="text-sm font-semibold text-[#2F2420]">
              ✨ ¡Sí, ahí estaré!
            </span>
            <span className="text-[10px] text-[#8C6947]">
              Celebraré con ustedes
            </span>
            {attendance === 'yes' && (
              <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#B8864E] text-white flex items-center justify-center text-[10px]">
                <Check className="w-2.5 h-2.5" aria-hidden="true" />
              </span>
            )}
          </button>

          {/* Opción NO */}
          <button
            ref={(el) => {
              attendanceRefs.current[1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={attendance === 'no'}
            tabIndex={attendance === 'no' ? 0 : -1}
            disabled={isDeadlinePassed}
            onClick={() => onSetAttendance('no')}
            onKeyDown={(e) => handleAttendanceKeyDown(e, 1)}
            className={`relative p-3.5 rounded-xl border text-center transition-all duration-300 flex flex-col items-center justify-center gap-1 select-none focus:outline-none focus:ring-2 focus:ring-[#B8864E]/60 ${
              isDeadlinePassed ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
            } ${
              attendance === 'no'
                ? 'bg-[#FAF3E8] border-[#B8864E] shadow-[0_3px_12px_rgba(184,134,78,0.22)] ring-1 ring-[#B8864E]'
                : 'bg-white/70 border-[#DFCBB5] hover:bg-white hover:border-[#C8AD90] opacity-80'
            }`}
          >
            <span className="text-sm font-semibold text-[#2F2420]">
              💌 No podré asistir
            </span>
            <span className="text-[10px] text-[#8C6947]">
              Los acompañaré de corazón
            </span>
            {attendance === 'no' && (
              <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#B8864E] text-white flex items-center justify-center text-[10px]">
                <Check className="w-2.5 h-2.5" aria-hidden="true" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* RAMIFICACIÓN: SI CONFIRMA ASISTENCIA */}
      {attendance === 'yes' ? (
        <div className="space-y-6 animate-fadeIn transition-all duration-500">
          {/* MÓDULO DE PASES CONFIRMADOS */}
          {features.showPassCount && stepNumbers.passCount !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[#8C6947] uppercase">
                  {stepNumbers.passCount}. Cantidad de Asistentes
                </span>
                <span className="text-[10px] text-[#916E49] italic">
                  (Máximo {maxPasses})
                </span>
              </div>

              <GuestStepper
                value={attendeesCount}
                max={maxPasses}
                disabled={isDeadlinePassed}
                onDecrement={onDecrementAttendees}
                onIncrement={onIncrementAttendees}
              />
            </div>
          )}

          {/* MÓDULO DE MENÚ Y RESTRICCIONES ALIMENTARIAS (BR-01) */}
          {(features.showMenu || features.showAllergies) &&
            stepNumbers.menuSection !== null && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Utensils
                      className="w-3.5 h-3.5 text-[#B8864E] shrink-0"
                      aria-hidden="true"
                    />
                    {features.showAllergies ? (
                      <label
                        id="rsvp-menu-heading"
                        htmlFor="rsvp-allergies"
                        className="text-[11px] font-semibold tracking-[0.18em] text-[#8C6947] uppercase"
                      >
                        {stepNumbers.menuSection}.{' '}
                        {features.showMenu
                          ? 'Menú y Restricciones Alimentarias'
                          : 'Restricciones Alimentarias'}
                      </label>
                    ) : (
                      <span
                        id="rsvp-menu-heading"
                        className="text-[11px] font-semibold tracking-[0.18em] text-[#8C6947] uppercase"
                      >
                        {stepNumbers.menuSection}. Preferencia de Menú
                      </span>
                    )}
                  </div>
                </div>

                {features.showMenu && (
                  <div className="space-y-2">
                    {isSingleAttendee ? (
                      /* 1 asistente: radiogroup accesible con flechas y roving tabIndex */
                      <div
                        role="radiogroup"
                        aria-labelledby="rsvp-menu-heading"
                        className="flex flex-wrap gap-1.5 sm:gap-2"
                      >
                        {menuOptions.map((menu, index) => {
                          const isSelected = selectedMenus[0] === menu.value;
                          return (
                            <button
                              key={menu.id}
                              ref={(el) => {
                                singleMenuRefs.current[index] = el;
                              }}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              tabIndex={
                                index === selectedSingleMenuIndex ? 0 : -1
                              }
                              disabled={isDeadlinePassed}
                              onClick={() => onSelectSingleMenu(menu.value)}
                              onKeyDown={(e) =>
                                handleSingleMenuKeyDown(e, index)
                              }
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border flex items-center gap-1.5 select-none focus:outline-none focus:ring-2 focus:ring-[#B8864E]/60 ${
                                isDeadlinePassed
                                  ? 'cursor-not-allowed opacity-70'
                                  : 'cursor-pointer'
                              } ${
                                isSelected
                                  ? 'bg-[#FAF3E8] border-[#B8864E] text-[#2F2420] shadow-xs'
                                  : 'bg-white/70 border-[#DFCBB5] text-[#6E5542] hover:bg-white hover:border-[#C8AD90]'
                              }`}
                            >
                              {isSelected && (
                                <Check
                                  className="w-3 h-3 text-[#B8864E] stroke-[2.5]"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{menu.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* >1 asistente: contadores compactos por plato (BR-01: total == asistentes) */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#6E5542]">
                            Asigna 1 plato por cada asistente:
                          </span>
                          <span
                            aria-live="polite"
                            className={`px-2 py-0.5 rounded-full font-semibold border ${
                              remainingMenusCount === 0
                                ? 'bg-[#FAF3E8] border-[#B8864E]/60 text-[#7D5A38]'
                                : 'bg-amber-50 border-amber-400/70 text-amber-800'
                            }`}
                          >
                            <span className="sr-only">Platos asignados: </span>
                            {assignedMenusCount} / {attendeesCount}
                          </span>
                        </div>

                        <div
                          role="group"
                          aria-labelledby="rsvp-menu-heading"
                          className="rounded-xl bg-white/80 border border-[#DFCBB5] divide-y divide-[#F0E4D6]"
                        >
                          {menuOptions.map((menu) => {
                            const count = menuCounts[menu.value] ?? 0;
                            const canInc = canIncrementMenuOption(menu.value);
                            const canDec = !isDeadlinePassed && count > 0;

                            return (
                              <div
                                key={menu.id}
                                className="flex items-center justify-between px-3 py-2 text-xs"
                              >
                                <span
                                  className={`font-medium transition-colors ${
                                    count > 0
                                      ? 'text-[#2F2420]'
                                      : 'text-[#7D5F48]'
                                  }`}
                                >
                                  {menu.label}
                                </span>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!canDec}
                                    onClick={() => onDecrementMenu(menu.value)}
                                    aria-label={`Disminuir menú ${menu.label}`}
                                    className="w-7 h-7 rounded-lg bg-[#F5ECE0] hover:bg-[#FAF3E8] disabled:opacity-30 disabled:cursor-not-allowed border border-[#DFCBB5] flex items-center justify-center text-[#2F2420] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B8864E]/60"
                                  >
                                    <Minus
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                  </button>

                                  <span
                                    className={`w-5 text-center font-bold tabular-nums ${
                                      count > 0
                                        ? 'text-[#2F2420]'
                                        : 'text-[#A8927E]'
                                    }`}
                                  >
                                    {count}
                                  </span>

                                  <button
                                    type="button"
                                    disabled={!canInc}
                                    onClick={() => onIncrementMenu(menu.value)}
                                    aria-label={`Aumentar menú ${menu.label}`}
                                    className="w-7 h-7 rounded-lg bg-[#F5ECE0] hover:bg-[#FAF3E8] disabled:opacity-30 disabled:cursor-not-allowed border border-[#DFCBB5] flex items-center justify-center text-[#2F2420] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B8864E]/60"
                                  >
                                    <Plus
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {remainingMenusCount > 0 && (
                          <p className="text-[11px] text-[#8C5E35]">
                            Faltan asignar {remainingMenusCount}{' '}
                            {remainingMenusCount === 1 ? 'plato' : 'platos'}.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Campo de alergias severas */}
                {features.showAllergies && (
                  <div className="pt-1">
                    <input
                      id="rsvp-allergies"
                      type="text"
                      maxLength={RSVP_FIELD_LIMITS.allergiesMaxLength}
                      disabled={isDeadlinePassed}
                      value={allergies}
                      onChange={(e) =>
                        onUpdateTextField('allergies', e.target.value)
                      }
                      placeholder="¿Alguna alergia severa o condición? (opcional)"
                      className="w-full px-3.5 py-2 text-xs rounded-lg bg-white/90 border border-[#DFCBB5] text-[#2F2420] placeholder:text-[#A8927E] focus:outline-none focus:border-[#B8864E] focus:ring-1 focus:ring-[#B8864E] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    />
                  </div>
                )}
              </div>
            )}

          {/* MÓDULO DE CANCIÓN */}
          {features.showSong && stepNumbers.song !== null && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Music
                  className="w-3.5 h-3.5 text-[#B8864E]"
                  aria-hidden="true"
                />
                <label
                  htmlFor="rsvp-song"
                  className="text-[11px] font-semibold tracking-[0.18em] text-[#8C6947] uppercase"
                >
                  {stepNumbers.song}. La Chispa Festiva
                </label>
              </div>

              <p className="text-xs text-[#6E5542] italic">
                «¿Qué canción te saca a bailar sí o sí?»
              </p>

              <input
                id="rsvp-song"
                type="text"
                maxLength={RSVP_FIELD_LIMITS.songMaxLength}
                disabled={isDeadlinePassed}
                value={song}
                onChange={(e) => onUpdateTextField('song', e.target.value)}
                placeholder="Nombre de canción y artista (ej. Danza Kuduro)"
                className="w-full px-3.5 py-2 text-xs rounded-lg bg-white/90 border border-[#DFCBB5] text-[#2F2420] placeholder:text-[#A8927E] focus:outline-none focus:border-[#B8864E] focus:ring-1 focus:ring-[#B8864E] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              />
            </div>
          )}
        </div>
      ) : (
        /* RAMIFICACIÓN: SI INDICA QUE NO PODRÁ ASISTIR */
        <div className="bg-[#FAF3E8] border border-[#DFCBB5] rounded-xl p-4 text-center space-y-2 animate-fadeIn transition-all duration-500">
          <Heart
            className="w-5 h-5 text-[#B8864E] mx-auto fill-[#B8864E]/20"
            aria-hidden="true"
          />
          <p
            className="font-serif italic text-sm text-[#543F30] leading-relaxed"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            «Lamentamos mucho que no puedas acompañarnos, ¡te tendremos presente
            en el corazón en todo momento!»
          </p>
        </div>
      )}

      {/* MENSAJE PARA LOS NOVIOS (DISPONIBLE PARA AMBOS SI ESTÁ ACTIVO) */}
      {features.showDedication && stepNumbers.dedication !== null && (
        <div className="space-y-2 pt-1">
          <label
            htmlFor="rsvp-dedication"
            className="block text-[11px] font-semibold tracking-[0.18em] text-[#8C6947] uppercase"
          >
            {attendance === 'yes'
              ? `${stepNumbers.dedication}. Mensaje para los novios`
              : 'Mensaje o buenos deseos'}
          </label>

          <textarea
            id="rsvp-dedication"
            rows={3}
            maxLength={RSVP_FIELD_LIMITS.dedicationMaxLength}
            disabled={isDeadlinePassed}
            value={dedication}
            onChange={(e) => onUpdateTextField('dedication', e.target.value)}
            placeholder="Escribe una dedicatoria o deseo para la pareja..."
            className="w-full px-3.5 py-2.5 text-xs rounded-lg bg-white/90 border border-[#DFCBB5] text-[#2F2420] placeholder:text-[#A8927E] focus:outline-none focus:border-[#B8864E] focus:ring-1 focus:ring-[#B8864E] disabled:opacity-60 disabled:cursor-not-allowed transition-all resize-none"
          />
        </div>
      )}

      {/* MENSAJE DE ERROR DE VALIDACIÓN O ENVÍO */}
      {activeError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-[#FCEEEB] border border-[#D99B8A] px-3.5 py-2.5 text-xs text-[#8A3520]"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="leading-relaxed">{activeError}</span>
        </div>
      )}

      {/* BOTÓN DE CONFIRMACIÓN */}
      <div className="pt-2 text-center space-y-3">
        {!isDeadlinePassed && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#C2925A] via-[#B8864E] to-[#A4743E] hover:from-[#B8864E] hover:to-[#966835] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-xs sm:text-sm tracking-widest uppercase shadow-[0_4px_16px_rgba(184,134,78,0.32)] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#B8864E] focus:ring-offset-2 focus:ring-offset-[#FAF3EB]"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {isSubmitting
                ? 'Registrando...'
                : attendance === 'yes'
                ? 'Confirmar Asistencia'
                : 'Enviar Respuesta'}
            </span>
          </button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#8C6947]">
          <Clock className="w-3 h-3 text-[#B8864E]" aria-hidden="true" />
          <span>
            Fecha límite para responder: <strong>{rsvpDeadlineDisplay}</strong>
          </span>
        </div>
      </div>
    </form>
  );
}

export const BeachRsvpForm = PapelRasgadoRsvpForm;
export type { PapelRasgadoRsvpFormProps as BeachRsvpFormProps };
