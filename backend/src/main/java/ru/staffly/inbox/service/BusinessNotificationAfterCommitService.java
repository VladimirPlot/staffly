package ru.staffly.inbox.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

/** Defers secondary notification persistence until the authoritative business commit succeeds. */
@Service
@RequiredArgsConstructor
@Slf4j
public class BusinessNotificationAfterCommitService {
    private final BusinessNotificationBatchWriter writer;

    public void submit(List<BusinessNotificationCommand> commands) {
        List<BusinessNotificationCommand> batch = commands == null ? List.of() : List.copyOf(commands);
        if (batch.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()
                || !TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Business notifications require an active transaction");
        }
        // Owner notifications are intentionally secondary and best-effort: a rollback never reaches
        // afterCommit, while a notification failure here cannot roll back successful business work.
        // A process/infrastructure failure after commit may lose this batch; guaranteed delivery would
        // require a transactional outbox and is deliberately outside this alpha step.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    writer.write(batch);
                } catch (RuntimeException ex) {
                    log.warn("Failed to persist after-commit business notification batch (groups={})", batch.size(), ex);
                }
            }
        });
    }
}
