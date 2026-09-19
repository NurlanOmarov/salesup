-- Отметка «доступы отправлены клиенту»: владелец видит, что письмо с логинами и
-- паролями (ответственный + работники) ушло, и не забывает его отправить.
ALTER TABLE "Organization"
  ADD COLUMN "credentialsSentAt" TIMESTAMP(3),
  ADD COLUMN "credentialsSentTo" TEXT;
