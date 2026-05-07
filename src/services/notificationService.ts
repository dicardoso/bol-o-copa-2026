import { doc, updateDoc, arrayUnion, arrayRemove, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface PushSubscriptionMetadata {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const notificationService = {
  /**
   * Solicita permissão para notificações Push e retorna o status
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações desktop');
      return 'denied';
    }
    return await Notification.requestPermission();
  },

  /**
   * Inscreve o usuário para notificações Push e salva no Firestore
   * Em produção, você precisaria de chaves VAPID reais.
   */
  async subscribeToPush(userId: string) {
    try {
      if (Notification.permission !== 'granted') {
        const permission = await this.requestPermission();
        if (permission !== 'granted') return;
      }

      // No mundo real, aqui registraríamos o Service Worker e obteríamos a subscription
      // const registration = await navigator.serviceWorker.ready;
      // const subscription = await registration.pushManager.subscribe({...});
      
      // Simulação de metadados de inscrição para fins de arquitetura
      const mockSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/demo-endpoint',
        keys: {
          p256dh: 'mock-p256dh-key',
          auth: 'mock-auth-key'
        },
        device: navigator.userAgent,
        subscribedAt: new Date().toISOString()
      };

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pushSubscriptions: arrayUnion(mockSubscription),
        'preferences.pushNotifications': true
      });

      // Exemplo de notificação local imediata
      new Notification('Configuração Concluída', {
        body: 'Você receberá alertas do Nose para este dispositivo!',
        icon: '/favicon.ico'
      });
      
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      return false;
    }
  },

  /**
   * Remove inscrições de push
   */
  async unsubscribeFromPush(userId: string) {
    try {
      const userRef = doc(db, 'users', userId);
      // Em uma app real, removeríamos a subscription específica do navegador atual
      await updateDoc(userRef, {
        'preferences.pushNotifications': false
      });
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      return false;
    }
  },

  /**
   * Envia um e-mail através da nossa API SMTP no backend
   */
  async sendEmail(to: string, subject: string, body: string) {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          html: `
            <div style="font-family: sans-serif; padding: 40px; background-color: #f8fafc; color: #1e293b; max-width: 600px; margin: 0 auto; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #3b82f6; font-style: italic; font-weight: 900; letter-spacing: -0.05em; margin: 0;">NOSE BETS</h1>
                <p style="text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: 0.2em; color: #64748b; margin-top: 4px;">Plataforma de Apostas de Elite</p>
              </div>
              <div style="background-color: white; padding: 32px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <p style="font-size: 16px; line-height: 1.6; margin: 0;">${body}</p>
              </div>
              <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">Este é um e-mail automático. Não responda a esta mensagem.</p>
                <div style="margin-top: 16px;">
                  <a href="#" style="color: #3b82f6; text-decoration: none; font-weight: bold; font-size: 12px;">Configurações de Conta</a>
                </div>
              </div>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar e-mail');
      }

      console.log(`E-mail para ${to} enviado com sucesso via SMTP.`);
      return true;
    } catch (err) {
      console.error('Erro no serviço de e-mail:', err);
      // Fallback em caso de erro na API
      return false;
    }
  }
};
