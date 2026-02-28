package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingQuestion;

import java.util.List;
import java.util.Optional;

public interface TrainingQuestionRepository extends JpaRepository<TrainingQuestion, Long> {
    @Query("""
            select q from TrainingQuestion q
            where q.restaurant.id = :restaurantId
              and q.folder.id = :folderId
              and (:includeInactive = true or q.active = true)
              and (:q is null or trim(:q) = '' or lower(q.title) like lower(concat('%', :q, '%')) or lower(q.prompt) like lower(concat('%', :q, '%')))
            order by q.sortOrder asc, q.id asc
            """)
    List<TrainingQuestion> listForFolder(
            @Param("restaurantId") Long restaurantId,
            @Param("folderId") Long folderId,
            @Param("includeInactive") boolean includeInactive,
            @Param("q") String query
    );

    List<TrainingQuestion> findByRestaurantIdAndFolderIdInAndActiveTrue(Long restaurantId, List<Long> folderIds);
    Optional<TrainingQuestion> findByIdAndRestaurantId(Long id, Long restaurantId);
}
