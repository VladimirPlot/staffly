package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingQuestion;
import ru.staffly.training.model.TrainingQuestionGroup;

import java.util.List;
import java.util.Optional;

public interface TrainingQuestionRepository extends JpaRepository<TrainingQuestion, Long> {
    @Query("""
            select q from TrainingQuestion q
            where q.restaurant.id = :restaurantId
              and q.folder.id = :folderId
              and (:group is null or q.questionGroup = :group)
              and (:includeInactive = true or q.active = true)
              and (:q is null or trim(:q) = '' or lower(q.title) like lower(concat('%', :q, '%')) or lower(q.prompt) like lower(concat('%', :q, '%')))
            order by q.sortOrder asc, q.id asc
            """)
    List<TrainingQuestion> listForFolder(
            @Param("restaurantId") Long restaurantId,
            @Param("folderId") Long folderId,
            @Param("group") TrainingQuestionGroup group,
            @Param("includeInactive") boolean includeInactive,
            @Param("q") String query
    );

    @Query("""
            select q from TrainingQuestion q
            where q.restaurant.id = :restaurantId
              and q.folder.id = :folderId
              and q.questionGroup = :group
              and q.active = true
            """)
    List<TrainingQuestion> findActiveByRestaurantIdAndFolderIdAndQuestionGroup(@Param("restaurantId") Long restaurantId,
                                                                                @Param("folderId") Long folderId,
                                                                                @Param("group") TrainingQuestionGroup group);

    @Query("""
            select q from TrainingQuestion q
            where q.restaurant.id = :restaurantId
              and q.id in :questionIds
              and q.active = true
            """)
    List<TrainingQuestion> findActiveByRestaurantIdAndIdIn(@Param("restaurantId") Long restaurantId,
                                                           @Param("questionIds") List<Long> questionIds);

    @Query("""
            select q.folder.id as folderId, count(q.id) as cnt
            from TrainingQuestion q
            where q.restaurant.id = :restaurantId
              and q.questionGroup = :group
              and (:includeInactive = true or q.active = true)
            group by q.folder.id
            """)
    List<Object[]> countByFolderForMode(@Param("restaurantId") Long restaurantId,
                                        @Param("group") TrainingQuestionGroup group,
                                        @Param("includeInactive") boolean includeInactive);

    Optional<TrainingQuestion> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Query("""
            select distinct q from TrainingQuestion q
            join fetch q.folder f
            left join fetch f.visibilityPositions vp
            where q.id = :id
              and q.restaurant.id = :restaurantId
            """)
    Optional<TrainingQuestion> findByIdAndRestaurantIdWithFolderVisibility(@Param("id") Long id,
                                                                           @Param("restaurantId") Long restaurantId);
}
