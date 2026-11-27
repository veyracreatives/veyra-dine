/* Veyra NC Explorer live-status wrapper (read only) over the MIT m70 EZSocket library. */
#include <stdlib.h>
#include <string.h>
#include "m70_ezsocket.h"
#define VAPI __declspec(dllexport)

typedef struct {
  int ok;            /* 1 when status read worked */
  int device;        /* 0 unknown 1 stop 2 run 3 idle 4 offline 5 debug */
  int mode;
  int run;           /* 0 RST 1 EMG 2 RDY 3 AUT 4 SYN 5 CRS 6 BST 7 HLD */
  int alarm;
  unsigned int counter, tool, spindle, cycle, autotime, powertime;
  int load;
  int feedOverride, spindleOverride;
  double feed;
  char program[64];
  char alarmText[256];
} vnc_status;

VAPI void* vnc_open(const char* ip, int port) {
  m70_conn_t* c = (m70_conn_t*)calloc(1, sizeof(m70_conn_t));
  if (!c) return NULL;
  if (!m70_cnc_connect(ip, port, EZNC_SYS_MELDAS800M, c)) { free(c); return NULL; }
  return c;
}

VAPI void vnc_close(void* h) { if (h) { m70_cnc_disconnect((m70_conn_t*)h); free(h); } }

VAPI int vnc_read(void* h, vnc_status* s) {
  m70_conn_t* c = (m70_conn_t*)h;
  m70_device_status_e d = 0; m70_run_mode_e m = 0; m70_run_status_e r = 0;
  bool al = false; short o = 0; int32 ld = 0;
  memset(s, 0, sizeof(*s));
  if (!c) return -1;
  int e = m70_cnc_read_status(c, 1, &d, &m, &r);
  if (e != 0) return e;
  s->ok = 1; s->device = d; s->mode = m; s->run = r;
  if (m70_cnc_read_is_alarm(c, 1, &al) == 0) s->alarm = al ? 1 : 0;
  m70_cnc_read_counter(c, 1, &s->counter);
  m70_cnc_read_current_tool_no(c, 1, &s->tool);
  m70_cnc_read_spindle_speed(c, 1, &s->spindle, 1);
  if (m70_cnc_read_spindle_load(c, 1, &ld, 1, false) == 0) s->load = ld;
  m70_cnc_read_feed_speed(c, 1, &s->feed, FC);
  if (m70_cnc_read_feed_override(c, 1, &o) == 0) s->feedOverride = o;
  if (m70_cnc_read_spindle_override(c, 1, &o) == 0) s->spindleOverride = o;
  m70_cnc_read_cycle_time(c, &s->cycle);
  m70_cnc_read_auto_operation_time(c, &s->autotime);
  m70_cnc_read_power_on_time(c, &s->powertime);
  m70_cnc_read_main_program_name_ex(c, 1, PRG_TYPE_ProgramNo, s->program, sizeof(s->program) - 1);
  if (s->alarm) {
    alarm_string a[1]; memset(a, 0, sizeof(a));
    if (m70_cnc_read_alarm(c, 1, 1, M_ALM_ALL_ALARM, a) == 0) strncpy(s->alarmText, (const char*)a[0].text, sizeof(s->alarmText) - 1);
  }
  return 0;
}
