import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import es from '@angular/common/locales/es';

import { routes } from './app.routes';
import { es_ES, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { IconDefinition } from '@ant-design/icons-angular';
import { 
  PlusOutline, 
  DeleteOutline, 
  EditOutline, 
  SettingOutline, 
  TrophyOutline, 
  CalendarOutline, 
  UserOutline, 
  DashboardOutline, 
  PlayCircleOutline, 
  TeamOutline, 
  CopyOutline, 
  UploadOutline, 
  CheckOutline, 
  RightOutline, 
  LeftOutline, 
  InfoCircleOutline, 
  FilterOutline,
  UndoOutline,
  FileTextOutline,
  ShareAltOutline
} from '@ant-design/icons-angular/icons';

registerLocaleData(es);

const icons: IconDefinition[] = [ 
  PlusOutline, 
  DeleteOutline, 
  EditOutline, 
  SettingOutline, 
  TrophyOutline, 
  CalendarOutline, 
  UserOutline, 
  DashboardOutline, 
  PlayCircleOutline, 
  TeamOutline, 
  CopyOutline, 
  UploadOutline, 
  CheckOutline, 
  RightOutline, 
  LeftOutline, 
  InfoCircleOutline, 
  FilterOutline,
  UndoOutline,
  FileTextOutline,
  ShareAltOutline
];

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es' },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    provideNzI18n(es_ES),
    provideNzIcons(icons)
  ]
};
