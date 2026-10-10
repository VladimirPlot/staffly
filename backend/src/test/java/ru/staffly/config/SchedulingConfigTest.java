package ru.staffly.config;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.Trigger;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.scheduling.config.TaskManagementConfigUtils;
import org.springframework.scheduling.support.ScheduledMethodRunnable;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.inbox.job.BirthdayInboxJob;
import ru.staffly.inbox.job.InboxRecipientLimitJob;
import ru.staffly.inbox.job.InboxRetentionJob;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.invite.job.InvitationCleanupJob;
import ru.staffly.invite.service.InvitationExpiryService;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.push.config.PushProperties;
import ru.staffly.push.repository.PushDeliveryRepository;
import ru.staffly.push.service.PushDeliveryWorker;
import ru.staffly.push.service.PushDeviceService;
import ru.staffly.push.service.WebPushSender;
import ru.staffly.reminder.job.ReminderDispatchJob;
import ru.staffly.reminder.service.ReminderDispatchService;
import ru.staffly.restaurant.repository.RestaurantRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ScheduledFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SchedulingConfigTest {
    private final TaskScheduler scheduler = mock(TaskScheduler.class);

    // Use the real scheduled components but never execute their callbacks.
    // Force push on even for the API to prove isolation is profile-based.
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(SchedulingConfig.class, InvitationCleanupJob.class,
                    ReminderDispatchJob.class, BirthdayInboxJob.class, InboxRetentionJob.class,
                    InboxRecipientLimitJob.class, PushDeliveryWorker.class)
            .withPropertyValues("app.push.enabled=true", "app.push.worker.enabled=true")
            .withBean(TaskScheduler.class, () -> scheduler)
            .withBean(InvitationExpiryService.class, () -> mock(InvitationExpiryService.class))
            .withBean(RestaurantRepository.class, () -> mock(RestaurantRepository.class))
            .withBean(ReminderDispatchService.class, () -> mock(ReminderDispatchService.class))
            .withBean(RestaurantMemberRepository.class, () -> mock(RestaurantMemberRepository.class))
            .withBean(InboxMessageRepository.class, () -> mock(InboxMessageRepository.class))
            .withBean(InboxRecipientRepository.class, () -> mock(InboxRecipientRepository.class))
            .withBean(InboxMessageService.class, () -> mock(InboxMessageService.class))
            .withBean(RestaurantTimeService.class, () -> mock(RestaurantTimeService.class))
            .withBean(PushDeliveryRepository.class, () -> mock(PushDeliveryRepository.class))
            .withBean(PushDeviceService.class, () -> mock(PushDeviceService.class))
            .withBean(WebPushSender.class, () -> mock(WebPushSender.class))
            .withBean(PushProperties.class,
                    () -> new PushProperties(true, new PushProperties.Worker(true), null));

    @ParameterizedTest
    @ValueSource(strings = {"", "dev", "prod", "test"})
    void nonWorkerProfilesDoNotRegisterScheduledJobs(String profiles) {
        withProfiles(profiles).run(context -> {
            assertThat(context).hasNotFailed()
                    .doesNotHaveBean(SchedulingConfig.class)
                    .doesNotHaveBean(ScheduledAnnotationBeanPostProcessor.class)
                    .doesNotHaveBean(TaskManagementConfigUtils.SCHEDULED_ANNOTATION_PROCESSOR_BEAN_NAME);
            assertThat(context).hasSingleBean(PushDeliveryWorker.class);
            verifyNoInteractions(scheduler);
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"worker", "dev,worker", "prod,worker"})
    void workerProfilesRegisterEveryJobExactlyOnce(String profiles) {
        when(scheduler.schedule(any(Runnable.class), any(Trigger.class)))
                .thenAnswer(invocation -> mock(ScheduledFuture.class));
        when(scheduler.scheduleWithFixedDelay(any(Runnable.class), any(Instant.class), any(Duration.class)))
                .thenAnswer(invocation -> mock(ScheduledFuture.class));

        withProfiles(profiles).run(context -> {
            assertThat(context).hasNotFailed()
                    .hasSingleBean(SchedulingConfig.class)
                    .hasSingleBean(ScheduledAnnotationBeanPostProcessor.class);
            var processor = context.getBean(ScheduledAnnotationBeanPostProcessor.class);
            assertThat(processor.getScheduledTasks())
                    .extracting(task -> ((ScheduledMethodRunnable) task.getTask().getRunnable())
                            .getMethod().getDeclaringClass().getName())
                    .containsExactlyInAnyOrder(InvitationCleanupJob.class.getName(),
                            ReminderDispatchJob.class.getName(), BirthdayInboxJob.class.getName(),
                            InboxRetentionJob.class.getName(), InboxRecipientLimitJob.class.getName(),
                            PushDeliveryWorker.class.getName());
            verify(scheduler, times(5)).schedule(any(Runnable.class), any(Trigger.class));
            verify(scheduler).scheduleWithFixedDelay(any(Runnable.class), any(Instant.class),
                    eq(Duration.ofSeconds(5)));
            verifyNoMoreInteractions(scheduler);
        });
    }

    private ApplicationContextRunner withProfiles(String profiles) {
        return runner.withInitializer(context -> context.getEnvironment()
                .setActiveProfiles(profiles.isEmpty() ? new String[0] : profiles.split(",")));
    }
}
