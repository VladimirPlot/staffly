package ru.staffly.inbox.service;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class BusinessNotificationAfterCommitServiceTest {
    @Test
    void notificationFailureAfterCommitCannotEscapeIntoCompletedBusinessTransaction() {
        BusinessNotificationBatchWriter writer = mock(BusinessNotificationBatchWriter.class);
        BusinessNotificationCommand command = mock(BusinessNotificationCommand.class);
        doThrow(new RuntimeException("notification database unavailable")).when(writer).write(List.of(command));
        BusinessNotificationAfterCommitService service = new BusinessNotificationAfterCommitService(writer);

        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            service.submit(List.of(command));
            TransactionSynchronization synchronization =
                    TransactionSynchronizationManager.getSynchronizations().get(0);
            assertDoesNotThrow(synchronization::afterCommit);
            verify(writer).write(List.of(command));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }

    @Test
    void rolledBackTransactionNeverInvokesWriter() {
        BusinessNotificationBatchWriter writer = mock(BusinessNotificationBatchWriter.class);
        BusinessNotificationCommand command = mock(BusinessNotificationCommand.class);
        BusinessNotificationAfterCommitService service = new BusinessNotificationAfterCommitService(writer);

        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            service.submit(List.of(command));
            TransactionSynchronization synchronization =
                    TransactionSynchronizationManager.getSynchronizations().get(0);
            synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
            verifyNoInteractions(writer);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }

    @Test
    void refusesToLoseCommandsOutsideTransaction() {
        BusinessNotificationAfterCommitService service =
                new BusinessNotificationAfterCommitService(mock(BusinessNotificationBatchWriter.class));
        assertThrows(IllegalStateException.class, () -> service.submit(List.of(mock(BusinessNotificationCommand.class))));
    }
}
